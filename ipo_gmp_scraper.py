```python
# ============================================================
# IPO GMP SCRAPER
# ============================================================
#
# Source:
# https://www.ipowatch.info/
#
# Creates:
#   1. ipo_gmp_result.csv
#   2. ipo_gmp_history.csv
#
# Designed for:
#   GitHub Actions
#   30-minute scheduled execution
#
# ============================================================

import re
from pathlib import Path

import pandas as pd
from playwright.sync_api import sync_playwright


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

RESULT_FILE = BASE_DIR / "ipo_gmp_result.csv"
HISTORY_FILE = BASE_DIR / "ipo_gmp_history.csv"

SOURCE_URL = "https://www.ipowatch.info/"

INDIA_TIMEZONE = "Asia/Kolkata"


# ============================================================
# HELPERS
# ============================================================

def clean_text(value):
    if value is None:
        return ""

    value = str(value)

    value = value.replace("\xa0", " ")

    value = re.sub(r"\s+", " ", value)

    return value.strip()


def numeric_value(value):
    """
    Extract first numeric value.

    Examples:
        ₹125       -> 125
        125        -> 125
        +125       -> 125
        -125       -> -125
        ₹1,250     -> 1250
    """

    if value is None:
        return 0.0

    text = clean_text(value)

    text = text.replace(",", "")

    match = re.search(
        r"-?\d+(?:\.\d+)?",
        text
    )

    if not match:
        return 0.0

    try:
        return float(match.group())
    except Exception:
        return 0.0


def percentage_value(value):
    """
    Extract percentage.

    Example:
        25% -> 25
    """

    if value is None:
        return 0.0

    text = clean_text(value)

    match = re.search(
        r"-?\d+(?:\.\d+)?\s*%",
        text
    )

    if not match:
        return 0.0

    try:
        return float(
            re.search(
                r"-?\d+(?:\.\d+)?",
                match.group()
            ).group()
        )
    except Exception:
        return 0.0


def find_column(columns, keywords):
    """
    Find a column by keyword.

    Matching is case-insensitive.
    """

    for column in columns:

        column_text = clean_text(
            column
        ).lower()

        for keyword in keywords:

            if keyword.lower() in column_text:

                return column

    return None


def parse_price_range(value):
    """
    Extract price from issue price.

    Examples:

        100-110       -> 110
        ₹100 - ₹110   -> 110
        110           -> 110

    For IPO GMP percentage calculation,
    the upper issue price is normally appropriate.
    """

    if value is None:
        return 0.0

    text = clean_text(value)

    text = text.replace(",", "")

    numbers = re.findall(
        r"\d+(?:\.\d+)?",
        text
    )

    if not numbers:
        return 0.0

    try:
        return float(numbers[-1])
    except Exception:
        return 0.0


# ============================================================
# FIND GMP TABLE
# ============================================================

def get_gmp_table(page):

    tables = page.locator("table")

    count = tables.count()

    print(
        f"Tables found: {count}"
    )

    if count == 0:

        raise RuntimeError(
            "No HTML tables found on the page."
        )

    best_table = None

    best_score = -1

    for i in range(count):

        try:

            table = tables.nth(i)

            text = clean_text(
                table.inner_text()
            ).lower()

            score = 0

            keywords = [
                "gmp",
                "ipo",
                "company",
                "listing",
                "current",
                "return",
                "issue",
            ]

            for keyword in keywords:

                if keyword in text:

                    score += 1

            print(
                f"Table {i + 1} score: {score}"
            )

            if score > best_score:

                best_score = score

                best_table = table

        except Exception as error:

            print(
                f"Could not inspect table {i + 1}: {error}"
            )

    if best_table is None:

        raise RuntimeError(
            "Correct IPO GMP table not found."
        )

    print(
        f"Selected GMP table with score: {best_score}"
    )

    return best_table


# ============================================================
# EXTRACT TABLE
# ============================================================

def extract_table_data(table):

    rows = table.locator("tr")

    row_count = rows.count()

    print(
        f"Rows found in GMP table: {row_count}"
    )

    if row_count < 2:

        raise RuntimeError(
            "GMP table contains no data rows."
        )

    headers = []

    first_row = rows.nth(0)

    header_cells = first_row.locator(
        "th, td"
    )

    for i in range(
        header_cells.count()
    ):

        headers.append(
            clean_text(
                header_cells.nth(i).inner_text()
            )
        )

    print(
        "Detected headers:"
    )

    print(
        headers
    )

    data = []

    for r in range(
        1,
        row_count
    ):

        row = rows.nth(r)

        cells = row.locator(
            "td, th"
        )

        cell_count = cells.count()

        if cell_count == 0:

            continue

        values = []

        for c in range(
            cell_count
        ):

            values.append(
                clean_text(
                    cells.nth(c).inner_text()
                )
            )

        if not any(values):

            continue

        if len(values) < len(headers):

            values.extend(
                [""] *
                (
                    len(headers)
                    - len(values)
                )
            )

        elif len(values) > len(headers):

            values = values[
                :len(headers)
            ]

        row_dict = dict(
            zip(
                headers,
                values
            )
        )

        data.append(
            row_dict
        )

    return data


# ============================================================
# NORMALIZE DATA
# ============================================================

def normalize_data(raw_data):

    if not raw_data:

        return pd.DataFrame()

    df = pd.DataFrame(
        raw_data
    )

    print(
        f"Raw records: {len(df)}"
    )

    print(
        f"Raw columns: {list(df.columns)}"
    )


    # ========================================================
    # COMPANY / IPO
    # ========================================================

    ipo_col = find_column(
        df.columns,
        [
            "company",
            "ipo",
            "name",
        ]
    )


    # ========================================================
    # GMP COLUMN
    #
    # Website currently may return:
    #
    # COMPANY | ISSUE | LISTING | CURRENT | RETURN
    #
    # Therefore CURRENT is treated as GMP.
    # ========================================================

    gmp_col = find_column(
        df.columns,
        [
            "gmp",
            "grey market premium",
            "grey market",
            "premium",
            "current",
        ]
    )


    # ========================================================
    # GMP %
    # ========================================================

    gmp_percent_col = find_column(
        df.columns,
        [
            "gmp %",
            "gmp%",
            "gain %",
            "gain%",
            "return",
            "premium %",
        ]
    )


    # ========================================================
    # ISSUE PRICE
    # ========================================================

    price_col = find_column(
        df.columns,
        [
            "issue price",
            "issue",
            "price",
        ]
    )


    # ========================================================
    # LISTING PRICE
    # ========================================================

    listing_col = find_column(
        df.columns,
        [
            "listing",
            "est. listing",
            "estimated listing",
        ]
    )


    # ========================================================
    # UPDATED
    # ========================================================

    updated_col = find_column(
        df.columns,
        [
            "updated",
            "last updated",
        ]
    )


    print(
        "IPO column:",
        ipo_col
    )

    print(
        "GMP column:",
        gmp_col
    )

    print(
        "GMP % column:",
        gmp_percent_col
    )

    print(
        "Price column:",
        price_col
    )

    print(
        "Listing column:",
        listing_col
    )


    # ========================================================
    # VALIDATE IPO COLUMN
    # ========================================================

    if ipo_col is None:

        raise RuntimeError(
            "IPO/company column not found."
        )


    # ========================================================
    # GMP FALLBACK
    # ========================================================

    if gmp_col is None:

        raise RuntimeError(
            "GMP column not found. "
            "Expected GMP or CURRENT column."
        )


    # ========================================================
    # CREATE RESULT
    # ========================================================

    result = pd.DataFrame()


    # ========================================================
    # IPO NAME
    # ========================================================

    result["IPO Name"] = (
        df[ipo_col]
        .astype(str)
        .map(clean_text)
    )


    # ========================================================
    # GMP
    # ========================================================

    result["GMP"] = (
        df[gmp_col]
        .astype(str)
        .map(numeric_value)
    )


    # ========================================================
    # IPO PRICE
    # ========================================================

    if price_col:

        result["IPO Price"] = (
            df[price_col]
            .astype(str)
            .map(parse_price_range)
        )

    else:

        result["IPO Price"] = 0.0


    # ========================================================
    # GMP %
    # ========================================================

    if gmp_percent_col:

        result["GMP %"] = (
            df[gmp_percent_col]
            .astype(str)
            .map(percentage_value)
        )

    else:

        result["GMP %"] = 0.0

        valid = (
            result["IPO Price"] > 0
        )

        result.loc[
            valid,
            "GMP %"
        ] = (
            result.loc[
                valid,
                "GMP"
            ]
            /
            result.loc[
                valid,
                "IPO Price"
            ]
            *
            100
        )


    # ========================================================
    # ESTIMATED LISTING
    # ========================================================

    if listing_col:

        result["Estimated Listing"] = (
            df[listing_col]
            .astype(str)
            .map(numeric_value)
        )

    else:

        result["Estimated Listing"] = (
            result["IPO Price"]
            +
            result["GMP"]
        )


    # ========================================================
    # UPDATED
    # ========================================================

    if updated_col:

        result["Updated"] = (
            df[updated_col]
            .astype(str)
            .map(clean_text)
        )

    else:

        result["Updated"] = ""


    # ========================================================
    # REMOVE EMPTY NAMES
    # ========================================================

    result = result[
        result["IPO Name"].str.len() > 0
    ].copy()


    # ========================================================
    # REMOVE HEADER ROWS
    # ========================================================

    result = result[
        ~result[
            "IPO Name"
        ]
        .str
        .lower()
        .isin(
            [
                "ipo",
                "company",
                "name",
                "ipo name",
            ]
        )
    ].copy()


    return result


# ============================================================
# ADD DATE COLUMNS
# ============================================================

def add_ipo_dates(result):

    result["Open"] = ""

    result["Close"] = ""

    result["BOA Date"] = ""

    result["Listing Date"] = ""

    return result


# ============================================================
# SAVE RESULT
# ============================================================

def save_result(df):

    if df.empty:

        raise RuntimeError(
            "No IPO GMP data extracted."
        )


    # ========================================================
    # CLEAN NAME
    # ========================================================

    df["IPO Name"] = (
        df["IPO Name"]
        .astype(str)
        .map(clean_text)
    )


    # ========================================================
    # NUMERIC COLUMNS
    # ========================================================

    numeric_columns = [
        "GMP",
        "GMP %",
        "IPO Price",
        "Estimated Listing",
    ]

    for column in numeric_columns:

        if column in df.columns:

            df[column] = pd.to_numeric(
                df[column],
                errors="coerce"
            ).fillna(0)


    # ========================================================
    # GMP %
    # ========================================================

    valid = (
        df["IPO Price"] > 0
    )

    zero_percent = (
        df["GMP %"] == 0
    )

    calculate_percent = (
        valid &
        zero_percent
    )

    df.loc[
        calculate_percent,
        "GMP %"
    ] = (
        df.loc[
            calculate_percent,
            "GMP"
        ]
        /
        df.loc[
            calculate_percent,
            "IPO Price"
        ]
        *
        100
    )


    # ========================================================
    # ESTIMATED LISTING
    # ========================================================

    df["Estimated Listing"] = (
        df["IPO Price"]
        +
        df["GMP"]
    )


    # ========================================================
    # TIMESTAMP
    # ========================================================

    now = pd.Timestamp.now(
        tz=INDIA_TIMEZONE
    )

    df["Last Updated"] = (
        now.strftime(
            "%d-%b-%Y %H:%M"
        )
    )


    # ========================================================
    # REMOVE DUPLICATES
    # ========================================================

    df = df.drop_duplicates(
        subset=[
            "IPO Name"
        ],
        keep="first"
    )


    # ========================================================
    # COLUMN ORDER
    # ========================================================

    preferred_columns = [
        "IPO Name",
        "GMP",
        "GMP %",
        "IPO Price",
        "Estimated Listing",
        "Updated",
        "Open",
        "Close",
        "BOA Date",
        "Listing Date",
        "Last Updated",
    ]

    final_columns = [
        column
        for column in preferred_columns
        if column in df.columns
    ]

    remaining_columns = [
        column
        for column in df.columns
        if column not in final_columns
    ]

    df = df[
        final_columns +
        remaining_columns
    ]


    # ========================================================
    # SAVE
    # ========================================================

    df.to_csv(
        RESULT_FILE,
        index=False,
        encoding="utf-8-sig"
    )

    print(
        f"Saved {len(df)} IPO records."
    )

    print(
        RESULT_FILE
    )


# ============================================================
# UPDATE HISTORY
# ============================================================

def update_history(current_df):

    if current_df.empty:

        return


    now = pd.Timestamp.now(
        tz=INDIA_TIMEZONE
    )


    history_rows = []


    for _, row in current_df.iterrows():

        history_rows.append(
            {
                "IPO Name":
                    clean_text(
                        row.get(
                            "IPO Name",
                            ""
                        )
                    ),

                "GMP Numeric":
                    float(
                        row.get(
                            "GMP",
                            0
                        )
                    ),

                "GMP %":
                    float(
                        row.get(
                            "GMP %",
                            0
                        )
                    ),

                "Data Date":
                    now.strftime(
                        "%Y-%m-%d"
                    ),

                "Data Time":
                    now.strftime(
                        "%H:%M:%S"
                    ),

                "Last Updated":
                    now.strftime(
                        "%Y-%m-%d %H:%M:%S"
                    ),
            }
        )


    new_history = pd.DataFrame(
        history_rows
    )


    # ========================================================
    # LOAD EXISTING HISTORY
    # ========================================================

    if HISTORY_FILE.exists():

        try:

            old_history = pd.read_csv(
                HISTORY_FILE
            )

        except Exception:

            old_history = pd.DataFrame()

    else:

        old_history = pd.DataFrame()


    # ========================================================
    # COMBINE
    # ========================================================

    if not old_history.empty:

        history = pd.concat(
            [
                old_history,
                new_history,
            ],
            ignore_index=True
        )

    else:

        history = new_history


    # ========================================================
    # REQUIRED COLUMNS
    # ========================================================

    columns = [
        "IPO Name",
        "GMP Numeric",
        "GMP %",
        "Data Date",
        "Data Time",
        "Last Updated",
    ]


    for column in columns:

        if column not in history.columns:

            history[column] = ""


    history = history[
        columns
    ]


    # ========================================================
    # NUMERIC
    # ========================================================

    history["GMP Numeric"] = pd.to_numeric(
        history["GMP Numeric"],
        errors="coerce"
    ).fillna(0)


    history["GMP %"] = pd.to_numeric(
        history["GMP %"],
        errors="coerce"
    ).fillna(0)


    # ========================================================
    # REMOVE EXACT DUPLICATES
    # ========================================================

    history = history.drop_duplicates(
        subset=[
            "IPO Name",
            "Data Date",
            "Data Time",
            "GMP Numeric",
            "GMP %",
        ],
        keep="last"
    )


    # ========================================================
    # SORT
    # ========================================================

    history["_datetime"] = pd.to_datetime(
        history["Data Date"].astype(str)
        + " "
        + history["Data Time"].astype(str),
        errors="coerce"
    )


    history = history.sort_values(
        by="_datetime",
        ascending=False
    )


    history = history.drop(
        columns=[
            "_datetime"
        ]
    )


    # ========================================================
    # SAVE
    # ========================================================

    history.to_csv(
        HISTORY_FILE,
        index=False,
        encoding="utf-8-sig"
    )


    print(
        f"History records: {len(history)}"
    )

    print(
        HISTORY_FILE
    )


# ============================================================
# SCRAPER
# ============================================================

def scrape():

    print("=" * 70)

    print(
        "IPO GMP SCRAPER"
    )

    print("=" * 70)

    print(
        f"Source: {SOURCE_URL}"
    )

    print(
        f"Result: {RESULT_FILE}"
    )

    print(
        f"History: {HISTORY_FILE}"
    )


    with sync_playwright() as p:

        browser = p.chromium.launch(
            headless=True
        )


        page = browser.new_page(

            viewport={
                "width": 1920,
                "height": 1080,
            },

            user_agent=(
                "Mozilla/5.0 "
                "(X11; Linux x86_64) "
                "AppleWebKit/537.36 "
                "(KHTML, like Gecko) "
                "Chrome/131.0.0.0 "
                "Safari/537.36"
            ),
        )


        try:

            print(
                "Opening IPO GMP website..."
            )


            page.goto(
                SOURCE_URL,
                wait_until="domcontentloaded",
                timeout=120000
            )


            page.wait_for_timeout(
                5000
            )


            print(
                "Page loaded:"
            )

            print(
                page.title()
            )


            # =================================================
            # GET TABLE
            # =================================================

            table = get_gmp_table(
                page
            )


            # =================================================
            # EXTRACT
            # =================================================

            raw_data = extract_table_data(
                table
            )


            print(
                f"Raw records extracted: "
                f"{len(raw_data)}"
            )


            # =================================================
            # NORMALIZE
            # =================================================

            result = normalize_data(
                raw_data
            )


            # =================================================
            # DATES
            # =================================================

            result = add_ipo_dates(
                result
            )


            # =================================================
            # SAVE RESULT
            # =================================================

            save_result(
                result
            )


            # =================================================
            # UPDATE HISTORY
            # =================================================

            update_history(
                result
            )


            print("=" * 70)

            print(
                "SCRAPER COMPLETED SUCCESSFULLY"
            )

            print("=" * 70)


        finally:

            browser.close()


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    try:

        scrape()

    except Exception as error:

        print("=" * 70)

        print(
            "SCRAPER FAILED"
        )

        print("=" * 70)

        print(
            f"{type(error).__name__}: {error}"
        )

        raise
```
