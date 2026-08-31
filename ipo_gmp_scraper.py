# ============================================================
# IPO GMP SCRAPER
# ============================================================
#
# Creates:
#   1. ipo_gmp_result.csv
#   2. ipo_gmp_history.csv
#
# Designed for:
#   GitHub Actions
#   30-minute scheduled execution
#   IPO GMP Dashboard
#
# Source:
#   https://www.ipowatch.info/
#
# IMPORTANT:
#   This file contains ONLY Python.
#   Do not put HTML/CSS/JavaScript in this file.
# ============================================================

import os
import re
from datetime import datetime
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
    """Clean spaces and unwanted characters."""

    if value is None:
        return ""

    value = str(value)

    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def numeric_value(value):
    """Extract first numeric value from text."""

    if value is None:
        return 0.0

    text = clean_text(value)

    # Remove commas
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
    Extract percentage number.

    Supports both:
        25%
        25.5%

    and values without %:
        25
        25.5
    """

    if value is None:
        return 0.0

    text = clean_text(value)

    text = text.replace(",", "")

    # --------------------------------------------------------
    # First look for explicit percentage
    # --------------------------------------------------------

    match = re.search(
        r"-?\d+(?:\.\d+)?\s*%",
        text
    )

    if match:

        number_match = re.search(
            r"-?\d+(?:\.\d+)?",
            match.group()
        )

        if number_match:

            try:
                return float(
                    number_match.group()
                )

            except Exception:
                return 0.0

    # --------------------------------------------------------
    # If no % symbol exists, extract numeric value
    # --------------------------------------------------------

    match = re.search(
        r"-?\d+(?:\.\d+)?",
        text
    )

    if not match:
        return 0.0

    try:
        return float(
            match.group()
        )

    except Exception:
        return 0.0


def normalize_name(name):
    """Normalize IPO name for history matching."""

    name = clean_text(name)

    name = re.sub(
        r"\bIPO\b",
        "",
        name,
        flags=re.IGNORECASE
    )

    name = re.sub(
        r"\bSME\b",
        "",
        name,
        flags=re.IGNORECASE
    )

    name = re.sub(
        r"\s+",
        " ",
        name
    )

    return name.strip()


def parse_date(value):
    """Try to convert different date formats."""

    if not value:
        return pd.NaT

    value = clean_text(value)

    formats = [
        "%d-%b-%Y",
        "%d-%B-%Y",
        "%d %b %Y",
        "%d %B %Y",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%Y-%m-%d",
    ]

    for fmt in formats:

        try:

            return pd.to_datetime(
                value,
                format=fmt
            )

        except Exception:
            pass

    try:

        return pd.to_datetime(
            value,
            dayfirst=True,
            errors="coerce"
        )

    except Exception:

        return pd.NaT


def extract_date_from_text(text):
    """Find a date inside a text field."""

    if not text:
        return pd.NaT

    text = clean_text(text)

    patterns = [
        r"\d{1,2}-[A-Za-z]{3}-\d{4}",
        r"\d{1,2}-[A-Za-z]+-\d{4}",
        r"\d{1,2}\s+[A-Za-z]{3}\s+\d{4}",
        r"\d{1,2}\s+[A-Za-z]+\s+\d{4}",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            text,
            flags=re.IGNORECASE
        )

        if match:

            result = parse_date(
                match.group()
            )

            if not pd.isna(result):

                return result

    return pd.NaT


# ============================================================
# GET TABLE FROM WEBSITE
# ============================================================

def get_gmp_table(page):
    """
    Find the IPO GMP table.

    The website can change table structure, therefore
    multiple keywords are used for scoring.
    """

    tables = page.locator("table")

    count = tables.count()

    print(
        f"Tables found: {count}"
    )

    if count == 0:

        raise RuntimeError(
            "No tables found on IPOWatch page."
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
                "issue",
                "listing",
                "current",
                "return",
                "price",
                "updated",
            ]

            for keyword in keywords:

                if keyword in text:

                    score += 1

            if score > best_score:

                best_score = score
                best_table = table

        except Exception:

            continue

    if best_table is None:

        raise RuntimeError(
            "Correct GMP table not found."
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

    # ========================================================
    # HEADERS
    # ========================================================

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
                header_cells
                .nth(i)
                .inner_text()
            )
        )

    print(
        "Detected headers:"
    )

    print(headers)

    # ========================================================
    # DATA
    # ========================================================

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
                    cells
                    .nth(c)
                    .inner_text()
                )
            )

        if not any(values):

            continue

        # ----------------------------------------------------
        # Make header/value lengths equal
        # ----------------------------------------------------

        if len(values) < len(headers):

            values.extend(
                [""] *
                (
                    len(headers)
                    -
                    len(values)
                )
            )

        if len(values) > len(headers):

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
# FIND COLUMN
# ============================================================

def find_column(columns, keywords):
    """
    Find a column.

    Exact match is attempted first.
    Partial match is attempted second.
    """

    # ========================================================
    # EXACT MATCH
    # ========================================================

    for column in columns:

        column_clean = clean_text(
            column
        ).lower()

        for keyword in keywords:

            keyword_clean = clean_text(
                keyword
            ).lower()

            if column_clean == keyword_clean:

                return column

    # ========================================================
    # PARTIAL MATCH
    # ========================================================

    for column in columns:

        column_clean = clean_text(
            column
        ).lower()

        for keyword in keywords:

            keyword_clean = clean_text(
                keyword
            ).lower()

            if keyword_clean in column_clean:

                return column

    return None


# ============================================================
# NORMALIZE GMP DATA
# ============================================================

def normalize_data(raw_data):

    if not raw_data:

        return pd.DataFrame()

    df = pd.DataFrame(
        raw_data
    )

    print(
        f"Raw columns: {list(df.columns)}"
    )

    # ========================================================
    # IPO NAME
    # ========================================================

    ipo_col = find_column(
        df.columns,
        [
            "ipo",
            "ipo name",
            "company",
            "company name",
            "name",
        ]
    )

    # ========================================================
    # GMP
    #
    # Old format:
    #   GMP
    #
    # Current format:
    #   CURRENT
    # ========================================================

    gmp_col = find_column(
        df.columns,
        [
            "gmp",
            "grey market premium",
            "grey market",
            "current",
        ]
    )

    # ========================================================
    # GMP %
    #
    # Old format:
    #   GMP %
    #
    # Current format:
    #   RETURN
    # ========================================================

    gmp_percent_col = find_column(
        df.columns,
        [
            "gmp %",
            "gmp%",
            "gain %",
            "gain%",
            "premium %",
            "return",
            "return %",
            "return%",
        ]
    )

    # ========================================================
    # IPO PRICE
    #
    # Old format:
    #   PRICE
    #   ISSUE PRICE
    #
    # Current format:
    #   ISSUE
    # ========================================================

    price_col = find_column(
        df.columns,
        [
            "issue price",
            "price",
            "issue",
        ]
    )

    # ========================================================
    # LISTING
    # ========================================================

    listing_col = find_column(
        df.columns,
        [
            "estimated listing",
            "est. listing",
            "listing",
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

    # ========================================================
    # DEBUG
    # ========================================================

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

    print(
        "Updated column:",
        updated_col
    )

    # ========================================================
    # VALIDATION
    # ========================================================

    if ipo_col is None:

        raise RuntimeError(
            "IPO/company column not found."
        )

    if gmp_col is None:

        raise RuntimeError(
            "GMP/CURRENT column not found."
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
            .map(numeric_value)
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

    # ========================================================
    # CALCULATE GMP %
    #
    # If RETURN exists, it is used first.
    #
    # If RETURN is unavailable or zero:
    #
    # GMP % = GMP / IPO Price * 100
    # ========================================================

    valid_price = (
        result["IPO Price"] > 0
    )

    zero_percent = (
        result["GMP %"] == 0
    )

    calculate_percent = (
        valid_price &
        zero_percent
    )

    result.loc[
        calculate_percent,
        "GMP %"
    ] = (
        result.loc[
            calculate_percent,
            "GMP"
        ]
        /
        result.loc[
            calculate_percent,
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
    # IF LISTING VALUE IS ZERO
    #
    # Calculate:
    #
    # Estimated Listing = IPO Price + GMP
    # ========================================================

    zero_listing = (
        result["Estimated Listing"] <= 0
    )

    valid_listing_calculation = (
        zero_listing &
        (result["IPO Price"] > 0)
    )

    result.loc[
        valid_listing_calculation,
        "Estimated Listing"
    ] = (
        result.loc[
            valid_listing_calculation,
            "IPO Price"
        ]
        +
        result.loc[
            valid_listing_calculation,
            "GMP"
        ]
    )

    # ========================================================
    # REMOVE EMPTY IPO NAMES
    # ========================================================

    result = result[
        result["IPO Name"]
        .str.len() > 0
    ].copy()

    # ========================================================
    # REMOVE OBVIOUS TABLE HEADERS
    # ========================================================

    result = result[
        ~result["IPO Name"]
        .str.lower()
        .isin(
            [
                "ipo",
                "company",
                "company name",
                "name",
                "ipo name",
            ]
        )
    ].copy()

    # ========================================================
    # RESET INDEX
    # ========================================================

    result = result.reset_index(
        drop=True
    )

    return result


# ============================================================
# EXTRACT ADDITIONAL IPO INFORMATION
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
    # CLEAN NAMES
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
    # CALCULATE GMP %
    # ========================================================

    valid = (
        (df["IPO Price"] > 0)
        &
        (df["GMP %"] == 0)
    )

    df.loc[
        valid,
        "GMP %"
    ] = (
        df.loc[
            valid,
            "GMP"
        ]
        /
        df.loc[
            valid,
            "IPO Price"
        ]
        *
        100
    )

    # ========================================================
    # CALCULATE ESTIMATED LISTING
    # ========================================================

    df["Estimated Listing"] = (
        df["IPO Price"]
        +
        df["GMP"]
    )

    # ========================================================
    # ADD TIMESTAMP
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
    # REMOVE DUPLICATE IPOs
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
        "Open",
        "Close",
        "BOA Date",
        "Listing Date",
        "Updated",
        "Last Updated",
    ]

    existing_columns = [
        column
        for column in preferred_columns
        if column in df.columns
    ]

    remaining_columns = [
        column
        for column in df.columns
        if column not in existing_columns
    ]

    df = df[
        existing_columns
        +
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
        f"Saved {len(df)} IPO records to:"
    )

    print(
        RESULT_FILE
    )

    # ========================================================
    # PRINT PREVIEW
    # ========================================================

    print()
    print("DATA PREVIEW")
    print("-" * 70)

    preview_columns = [
        "IPO Name",
        "GMP",
        "GMP %",
        "IPO Price",
        "Estimated Listing",
    ]

    preview_columns = [
        column
        for column in preview_columns
        if column in df.columns
    ]

    if preview_columns:

        print(
            df[
                preview_columns
            ].to_string(
                index=False
            )
        )

    print("-" * 70)


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
    # EXISTING HISTORY
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
    # ENSURE CORRECT COLUMNS
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

    history["GMP Numeric"] = (
        pd.to_numeric(
            history["GMP Numeric"],
            errors="coerce"
        )
        .fillna(0)
    )

    history["GMP %"] = (
        pd.to_numeric(
            history["GMP %"],
            errors="coerce"
        )
        .fillna(0)
    )

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
    # SORT LATEST FIRST
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
    # SAVE HISTORY
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
        f"Saved history to: {HISTORY_FILE}"
    )


# ============================================================
# SCRAPER
# ============================================================

def scrape():

    print("=" * 70)
    print("IPO GMP SCRAPER")
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

        # ====================================================
        # BROWSER
        # ====================================================

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

            # =================================================
            # OPEN WEBSITE
            # =================================================

            print(
                "Opening IPO GMP website..."
            )

            page.goto(
                SOURCE_URL,
                wait_until="domcontentloaded",
                timeout=120000
            )

            # =================================================
            # WAIT
            # =================================================

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
            # ADD DATE FIELDS
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

            # =================================================
            # SUCCESS
            # =================================================

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
        print("SCRAPER FAILED")
        print("=" * 70)

        print(
            f"{type(error).__name__}: {error}"
        )

        raise
