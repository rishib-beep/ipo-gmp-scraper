```python
# ============================================================
# IPO GMP SCRAPER
# ============================================================
#
# Files created/updated:
#
#   ipo_gmp_result.csv
#       Current/latest IPO GMP data
#
#   ipo_gmp_history.csv
#       Historical GMP observations
#
# Designed for GitHub Actions
# Runs every 30 minutes
#
# ============================================================

import os
import re
import asyncio
from datetime import datetime

import pandas as pd
from playwright.async_api import async_playwright


# ============================================================
# CONFIGURATION
# ============================================================

URL = "https://www.investorgain.com/report/ipo-gmp-live/331/"

CURRENT_FILE = "ipo_gmp_result.csv"
HISTORY_FILE = "ipo_gmp_history.csv"

TODAY = datetime.now().strftime("%Y-%m-%d")
NOW = datetime.now().strftime("%Y-%m-%d %H:%M:%S")


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clean_text(value):

    if value is None:
        return ""

    value = str(value)

    value = value.replace("\xa0", " ")

    value = re.sub(r"\s+", " ", value)

    return value.strip()


def extract_number(value):

    if value is None:
        return None

    match = re.search(
        r"-?\d+(?:\.\d+)?",
        str(value).replace(",", "")
    )

    if not match:
        return None

    try:
        return float(match.group())
    except Exception:
        return None


def extract_gmp(value):

    if value is None:
        return None

    value = str(value)

    # Example:
    # ₹330 (110.00%)
    # 65 ↓ / 330 ↑

    match = re.search(
        r"₹?\s*(-?\d+(?:\.\d+)?)",
        value
    )

    if match:
        return float(match.group(1))

    return None


def extract_gmp_percent(value):

    if value is None:
        return None

    value = str(value)

    match = re.search(
        r"\((-?\d+(?:\.\d+)?)%\)",
        value
    )

    if match:
        return float(match.group(1))

    return None


def extract_down_up(value):

    if value is None:
        return None, None

    value = str(value)

    matches = re.findall(
        r"(-?\d+(?:\.\d+)?)",
        value
    )

    if len(matches) >= 2:

        return (
            float(matches[-2]),
            float(matches[-1])
        )

    return None, None


def clean_ipo_name(name):

    if not name:
        return ""

    name = clean_text(name)

    # Remove common InvestorGain status suffixes
    name = re.sub(
        r"(?:IPO)?(?:CALLOTTED|CLOSED|OPEN|O|C|U)$",
        "",
        name,
        flags=re.IGNORECASE
    )

    name = re.sub(
        r"IPO$",
        "",
        name,
        flags=re.IGNORECASE
    )

    return name.strip()


# ============================================================
# FIND COLUMN
# ============================================================

def find_column(columns, names):

    normalized = {
        clean_text(c).upper(): c
        for c in columns
    }

    for name in names:

        key = clean_text(name).upper()

        if key in normalized:
            return normalized[key]

    return None


# ============================================================
# SCRAPE INVESTORGAIN
# ============================================================

async def scrape():

    print()
    print("=" * 70)
    print("OPENING INVESTORGAIN")
    print("=" * 70)

    async with async_playwright() as p:

        browser = await p.chromium.launch(
            headless=True
        )

        page = await browser.new_page()

        try:

            await page.goto(
                URL,
                wait_until="domcontentloaded",
                timeout=120000
            )

            await page.wait_for_timeout(
                5000
            )

            print(
                "FINAL URL:",
                page.url
            )

            print(
                "TITLE:",
                await page.title()
            )

            # ------------------------------------------------
            # Extract tables
            # ------------------------------------------------

            tables = await page.locator(
                "table"
            ).all()

            print(
                "Tables found:",
                len(tables)
            )

            all_rows = []

            for table_index, table in enumerate(tables):

                rows = await table.locator(
                    "tr"
                ).all()

                if not rows:
                    continue

                table_data = []

                for row in rows:

                    cells = await row.locator(
                        "th,td"
                    ).all()

                    values = []

                    for cell in cells:

                        text = await cell.inner_text()

                        values.append(
                            clean_text(text)
                        )

                    if values:
                        table_data.append(values)

                if len(table_data) < 2:
                    continue

                header = table_data[0]

                header_text = " ".join(
                    header
                ).upper()

                print()
                print(
                    f"TABLE {table_index + 1}:"
                )

                print(
                    header
                )

                # ------------------------------------------------
                # Identify GMP table
                # ------------------------------------------------

                if (
                    "GMP" not in header_text
                    or "PRICE" not in header_text
                ):
                    continue

                print(
                    "✓ GMP TABLE FOUND"
                )

                for row in table_data[1:]:

                    if len(row) < 5:
                        continue

                    # Match row to header length
                    row = row[:len(header)]

                    while len(row) < len(header):
                        row.append("")

                    record = dict(
                        zip(
                            header,
                            row
                        )
                    )

                    all_rows.append(
                        record
                    )

            await browser.close()

            return all_rows

        except Exception:

            await browser.close()

            raise


# ============================================================
# CONVERT SCRAPED DATA
# ============================================================

def create_current_dataframe(rows):

    records = []

    if not rows:
        return pd.DataFrame()

    columns = list(
        rows[0].keys()
    )

    name_col = find_column(
        columns,
        [
            "NAME",
            "IPO NAME"
        ]
    )

    gmp_col = find_column(
        columns,
        [
            "GMP"
        ]
    )

    price_col = find_column(
        columns,
        [
            "PRICE (₹)",
            "PRICE",
            "IPO PRICE"
        ]
    )

    subscription_col = find_column(
        columns,
        [
            "SUB",
            "SUBSCRIPTION"
        ]
    )

    ipo_size_col = find_column(
        columns,
        [
            "IPO SIZE"
        ]
    )

    lot_col = find_column(
        columns,
        [
            "LOT",
            "LOT SIZE"
        ]
    )

    open_col = find_column(
        columns,
        [
            "OPEN"
        ]
    )

    close_col = find_column(
        columns,
        [
            "CLOSE"
        ]
    )

    boa_col = find_column(
        columns,
        [
            "BOA DT",
            "BOA DATE"
        ]
    )

    listing_col = find_column(
        columns,
        [
            "LISTING",
            "LISTING DATE"
        ]
    )

    updated_col = find_column(
        columns,
        [
            "UPDATED-ON",
            "UPDATED",
            "UPDATED ON"
        ]
    )

    anchor_col = find_column(
        columns,
        [
            "ANCHOR"
        ]
    )

    rating_col = find_column(
        columns,
        [
            "RATING"
        ]
    )

    for row in rows:

        raw_name = (
            row.get(name_col, "")
            if name_col
            else ""
        )

        name = clean_ipo_name(
            raw_name
        )

        if not name:
            continue

        raw_gmp = (
            row.get(gmp_col, "")
            if gmp_col
            else ""
        )

        gmp = extract_gmp(
            raw_gmp
        )

        gmp_percent = extract_gmp_percent(
            raw_gmp
        )

        gmp_down, gmp_up = extract_down_up(
            raw_gmp
        )

        price = extract_number(
            row.get(price_col, "")
            if price_col
            else ""
        )

        # --------------------------------------------------------
        # Calculate GMP %
        # --------------------------------------------------------

        calculated_gmp_percent = None

        if (
            gmp is not None
            and price
            and price > 0
        ):

            calculated_gmp_percent = (
                gmp /
                price *
                100
            )

        if gmp_percent is None:

            gmp_percent = (
                calculated_gmp_percent
            )

        # --------------------------------------------------------
        # Estimated listing price
        # --------------------------------------------------------

        estimated_listing = None

        if (
            gmp is not None
            and price is not None
        ):

            estimated_listing = (
                price + gmp
            )

        records.append({

            "IPO Name":
                name,

            "GMP":
                gmp if gmp is not None
                else 0,

            "GMP %":
                round(
                    gmp_percent,
                    2
                )
                if gmp_percent is not None
                else 0,

            "GMP Down":
                gmp_down
                if gmp_down is not None
                else 0,

            "GMP Up":
                gmp_up
                if gmp_up is not None
                else 0,

            "Subscription":
                row.get(
                    subscription_col,
                    ""
                )
                if subscription_col
                else "",

            "IPO Price":
                price
                if price is not None
                else 0,

            "IPO Size":
                row.get(
                    ipo_size_col,
                    ""
                )
                if ipo_size_col
                else "",

            "Lot Size":
                extract_number(
                    row.get(
                        lot_col,
                        ""
                    )
                )
                if lot_col
                else "",

            "Open":
                row.get(
                    open_col,
                    ""
                )
                if open_col
                else "",

            "Close":
                row.get(
                    close_col,
                    ""
                )
                if close_col
                else "",

            "BOA Date":
                row.get(
                    boa_col,
                    ""
                )
                if boa_col
                else "",

            "Listing Date":
                row.get(
                    listing_col,
                    ""
                )
                if listing_col
                else "",

            "Updated":
                row.get(
                    updated_col,
                    ""
                )
                if updated_col
                else NOW,

            "Anchor":
                row.get(
                    anchor_col,
                    ""
                )
                if anchor_col
                else "",

            "Estimated Listing Price":
                estimated_listing
                if estimated_listing is not None
                else 0,

            "Calculated GMP %":
                round(
                    calculated_gmp_percent,
                    2
                )
                if calculated_gmp_percent is not None
                else 0,

            "Rating":
                row.get(
                    rating_col,
                    ""
                )
                if rating_col
                else "",

        })

    return pd.DataFrame(
        records
    )


# ============================================================
# SAVE CURRENT DATA
# ============================================================

def save_current_data(df):

    if df.empty:

        print(
            "No current IPO data found."
        )

        return

    # --------------------------------------------------------
    # Sort by Listing Date
    # Latest first
    # --------------------------------------------------------

    def listing_sort(value):

        if not value:
            return pd.Timestamp.min

        match = re.search(
            r"(\d{1,2})[-/]([A-Za-z]{3})",
            str(value)
        )

        if not match:
            return pd.Timestamp.min

        try:

            day = int(
                match.group(1)
            )

            month =
                pd.to_datetime(
                    match.group(2),
                    format="%b"
                ).month

            return pd.Timestamp(
                year=datetime.now().year,
                month=month,
                day=day
            )

        except Exception:

            return pd.Timestamp.min

    df["_sort_date"] = df[
        "Listing Date"
    ].apply(
        listing_sort
    )

    df = df.sort_values(
        "_sort_date",
        ascending=False
    )

    df = df.drop(
        columns=["_sort_date"]
    )

    df.to_csv(
        CURRENT_FILE,
        index=False,
        encoding="utf-8-sig"
    )

    print()
    print(
        "✓ Saved:",
        CURRENT_FILE
    )

    print(
        "Records:",
        len(df)
    )


# ============================================================
# HISTORY DATE PARSER
# ============================================================

def parse_history_date(value):

    if not value:
        return None

    value = str(value)

    # Example:
    # 20-Aug GMP: 270

    match = re.search(
        r"(\d{1,2})[-/]([A-Za-z]{3,9})",
        value
    )

    if not match:
        return None

    try:

        day = int(
            match.group(1)
        )

        month = pd.to_datetime(
            match.group(2)[:3],
            format="%b"
        ).month

        year = datetime.now().year

        return datetime(
            year,
            month,
            day
        ).strftime(
            "%Y-%m-%d"
        )

    except Exception:

        return None


# ============================================================
# ADD GMP HISTORY
# ============================================================

def create_history_rows(df):

    history = []

    for _, row in df.iterrows():

        name = row[
            "IPO Name"
        ]

        price = number_or_zero(
            row["IPO Price"]
        )

        # ----------------------------------------------------
        # 1. OPEN GMP
        # ----------------------------------------------------

        open_value = str(
            row.get(
                "Open",
                ""
            )
        )

        open_gmp = extract_historical_gmp(
            open_value
        )

        open_date = parse_history_date(
            open_value
        )

        if (
            open_gmp is not None
            and open_date
        ):

            history.append({

                "IPO Name":
                    name,

                "Date":
                    open_date,

                "GMP":
                    open_gmp,

                "GMP %":
                    round(
                        open_gmp /
                        price *
                        100,
                        2
                    )
                    if price > 0
                    else 0,

                "IPO Price":
                    price,

                "Updated":
                    NOW

            })


        # ----------------------------------------------------
        # 2. CLOSE GMP
        # ----------------------------------------------------

        close_value = str(
            row.get(
                "Close",
                ""
            )
        )

        close_gmp = extract_historical_gmp(
            close_value
        )

        close_date = parse_history_date(
            close_value
        )

        if (
            close_gmp is not None
            and close_date
        ):

            history.append({

                "IPO Name":
                    name,

                "Date":
                    close_date,

                "GMP":
                    close_gmp,

                "GMP %":
                    round(
                        close_gmp /
                        price *
                        100,
                        2
                    )
                    if price > 0
                    else 0,

                "IPO Price":
                    price,

                "Updated":
                    NOW

            })


        # ----------------------------------------------------
        # 3. CURRENT GMP
        # ----------------------------------------------------

        current_gmp = number_or_zero(
            row["GMP"]
        )

        updated =
            str(
                row.get(
                    "Updated",
                    ""
                )
            )

        current_date =
            parse_history_date(
                updated
            )

        if not current_date:

            current_date = TODAY

        history.append({

            "IPO Name":
                name,

            "Date":
                current_date,

            "GMP":
                current_gmp,

            "GMP %":
                round(
                    current_gmp /
                    price *
                    100,
                    2
                )
                if price > 0
                else 0,

            "IPO Price":
                price,

            "Updated":
                NOW

        })

    return pd.DataFrame(
        history
    )


# ============================================================
# HISTORICAL GMP EXTRACTION
# ============================================================

def extract_historical_gmp(value):

    if not value:
        return None

    match = re.search(
        r"GMP\s*:\s*(-?\d+(?:\.\d+)?)",
        str(value),
        flags=re.IGNORECASE
    )

    if not match:
        return None

    return float(
        match.group(1)
    )


# ============================================================
# NUMBER OR ZERO
# ============================================================

def number_or_zero(value):

    result = extract_number(
        value
    )

    if result is None:
        return 0

    return result


# ============================================================
# UPDATE HISTORY FILE
# ============================================================

def update_history(df):

    if df.empty:
        return

    new_history =
        create_history_rows(
            df
        )

    if new_history.empty:

        print(
            "No historical GMP rows found."
        )

        return


    # --------------------------------------------------------
    # Read existing history
    # --------------------------------------------------------

    if os.path.exists(
        HISTORY_FILE
    ):

        try:

            old_history =
                pd.read_csv(
                    HISTORY_FILE
                )

        except Exception:

            old_history =
                pd.DataFrame()

    else:

        old_history =
            pd.DataFrame()


    # --------------------------------------------------------
    # Combine
    # --------------------------------------------------------

    combined =
        pd.concat(
            [
                old_history,
                new_history
            ],
            ignore_index=True
        )


    # --------------------------------------------------------
    # Clean
    # --------------------------------------------------------

    combined["IPO Name"] =
        combined[
            "IPO Name"
        ].astype(str).str.strip()

    combined["Date"] =
        combined[
            "Date"
        ].astype(str).str.strip()


    # --------------------------------------------------------
    # Convert numeric
    # --------------------------------------------------------

    combined["GMP"] =
        pd.to_numeric(
            combined["GMP"],
            errors="coerce"
        ).fillna(0)

    combined["GMP %"] =
        pd.to_numeric(
            combined["GMP %"],
            errors="coerce"
        ).fillna(0)

    combined["IPO Price"] =
        pd.to_numeric(
            combined["IPO Price"],
            errors="coerce"
        ).fillna(0)


    # --------------------------------------------------------
    # Remove duplicate
    #
    # One GMP observation per IPO/date.
    #
    # Newest observation wins.
    # --------------------------------------------------------

    combined =
        combined.drop_duplicates(
            subset=[
                "IPO Name",
                "Date"
            ],
            keep="last"
        )


    # --------------------------------------------------------
    # Sort
    #
    # IPO + Date
    # Oldest → newest for chart
    # --------------------------------------------------------

    combined["_date_sort"] =
        pd.to_datetime(
            combined["Date"],
            errors="coerce"
        )


    combined =
        combined.sort_values(
            [
                "IPO Name",
                "_date_sort"
            ],
            ascending=[
                True,
                True
            ]
        )


    combined =
        combined.drop(
            columns=[
                "_date_sort"
            ]
        )


    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    combined.to_csv(
        HISTORY_FILE,
        index=False,
        encoding="utf-8-sig"
    )


    print()
    print(
        "✓ Historical GMP updated:"
    )

    print(
        HISTORY_FILE
    )

    print(
        "Total history rows:",
        len(combined)
    )


# ============================================================
# MAIN
# ============================================================

async def main():

    print()
    print("=" * 70)
    print("IPO GMP SCRAPER")
    print("=" * 70)

    print(
        "Time:",
        NOW
    )

    rows =
        await scrape()


    if not rows:

        print()
        print(
            "❌ No GMP table data found."
        )

        return


    print()
    print(
        "Rows scraped:",
        len(rows)
    )


    df =
        create_current_dataframe(
            rows
        )


    if df.empty:

        print(
            "❌ No IPO records created."
        )

        return


    print()
    print(
        "IPO records:",
        len(df)
    )


    # --------------------------------------------------------
    # SAVE CURRENT
    # --------------------------------------------------------

    save_current_data(
        df
    )


    # --------------------------------------------------------
    # UPDATE HISTORY
    # --------------------------------------------------------

    update_history(
        df
    )


    # --------------------------------------------------------
    # DISPLAY SAMPLE
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("CURRENT IPO GMP")
    print("=" * 70)

    print(
        df[
            [
                "IPO Name",
                "GMP",
                "GMP %",
                "IPO Price",
                "Listing Date",
                "Updated"
            ]
        ].to_string(
            index=False
        )
    )


    print()
    print("=" * 70)
    print("SCRAPING COMPLETED")
    print("=" * 70)


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    asyncio.run(
        main()
    )
```
