import os
import re
import asyncio
from datetime import datetime

import pandas as pd
from playwright.async_api import async_playwright


# ============================================================
# CONFIG
# ============================================================

URL = "https://www.investorgain.com/report/ipo-gmp-live/331/"

CURRENT_FILE = "ipo_gmp_result.csv"
HISTORY_FILE = "ipo_gmp_history.csv"

NOW = datetime.now()
TODAY = NOW.strftime("%Y-%m-%d")
UPDATED_TIME = NOW.strftime("%Y-%m-%d %H:%M:%S")


# ============================================================
# BASIC HELPERS
# ============================================================

def clean_text(value):

    if value is None:
        return ""

    value = str(value)
    value = value.replace("\xa0", " ")
    value = re.sub(r"\s+", " ", value)

    return value.strip()


def number(value):

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

    if not value:
        return None

    text = str(value)

    match = re.search(
        r"₹?\s*(-?\d+(?:\.\d+)?)",
        text
    )

    if match:
        return float(match.group(1))

    return None


def extract_gmp_percent(value):

    if not value:
        return None

    match = re.search(
        r"\((-?\d+(?:\.\d+)?)%\)",
        str(value)
    )

    if match:
        return float(match.group(1))

    return None


def extract_down_up(value):

    if not value:
        return None, None

    numbers = re.findall(
        r"-?\d+(?:\.\d+)?",
        str(value)
    )

    if len(numbers) >= 2:

        return (
            float(numbers[-2]),
            float(numbers[-1])
        )

    return None, None


def clean_ipo_name(name):

    name = clean_text(name)

    if not name:
        return ""

    # Remove InvestorGain status suffixes
    name = re.sub(
        r"(CALLOTTED|CLOSED|OPEN|IPO)$",
        "",
        name,
        flags=re.IGNORECASE
    )

    return name.strip()


def find_column(columns, candidates):

    for column in columns:

        column_clean = clean_text(
            column
        ).upper()

        for candidate in candidates:

            if candidate.upper() == column_clean:
                return column

    return None


# ============================================================
# SCRAPE
# ============================================================

async def scrape_investorgain():

    print("=" * 90)
    print("OPENING INVESTORGAIN")
    print("=" * 90)

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

            await page.wait_for_timeout(5000)

            print("Page:", page.url)
            print("Title:", await page.title())

            tables = await page.locator(
                "table"
            ).all()

            print(
                "Tables found:",
                len(tables)
            )

            final_rows = []

            for table_number, table in enumerate(tables):

                rows = await table.locator(
                    "tr"
                ).all()

                if len(rows) < 2:
                    continue

                table_data = []

                for row in rows:

                    cells = await row.locator(
                        "th, td"
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
                    f"TABLE {table_number + 1}"
                )

                print(header)

                # Correct GMP table detection
                if (
                    "GMP" not in header_text
                    or "PRICE" not in header_text
                ):
                    continue

                print(
                    "✓ CORRECT GMP TABLE FOUND"
                )

                for row in table_data[1:]:

                    row = row[:len(header)]

                    while len(row) < len(header):
                        row.append("")

                    record = dict(
                        zip(header, row)
                    )

                    final_rows.append(record)

            await browser.close()

            return final_rows

        except Exception:

            await browser.close()

            raise


# ============================================================
# CREATE CURRENT DATAFRAME
# ============================================================

def create_dataframe(rows):

    if not rows:
        return pd.DataFrame()

    columns = list(
        rows[0].keys()
    )

    name_col = find_column(
        columns,
        ["IPO Name", "Name"]
    )

    gmp_col = find_column(
        columns,
        ["GMP"]
    )

    price_col = find_column(
        columns,
        [
            "IPO Price",
            "Price",
            "Price (₹)"
        ]
    )

    subscription_col = find_column(
        columns,
        [
            "Subscription",
            "Sub"
        ]
    )

    ipo_size_col = find_column(
        columns,
        ["IPO Size"]
    )

    lot_col = find_column(
        columns,
        [
            "Lot Size",
            "Lot"
        ]
    )

    open_col = find_column(
        columns,
        ["Open"]
    )

    close_col = find_column(
        columns,
        ["Close"]
    )

    boa_col = find_column(
        columns,
        [
            "BOA Date",
            "BOA Dt"
        ]
    )

    listing_col = find_column(
        columns,
        [
            "Listing Date",
            "Listing"
        ]
    )

    updated_col = find_column(
        columns,
        [
            "Updated",
            "Updated-On"
        ]
    )

    anchor_col = find_column(
        columns,
        ["Anchor"]
    )

    rating_col = find_column(
        columns,
        ["Rating"]
    )

    records = []

    for row in rows:

        name = clean_ipo_name(
            row.get(name_col, "")
            if name_col
            else ""
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

        website_gmp_percent = (
            extract_gmp_percent(
                raw_gmp
            )
        )

        gmp_down, gmp_up = extract_down_up(
            raw_gmp
        )

        ipo_price = number(
            row.get(price_col, "")
            if price_col
            else ""
        )

        calculated_percent = 0

        if (
            gmp is not None
            and ipo_price
            and ipo_price > 0
        ):

            calculated_percent = (
                gmp /
                ipo_price *
                100
            )

        gmp_percent = (
            website_gmp_percent
            if website_gmp_percent is not None
            else calculated_percent
        )

        estimated_listing = 0

        if (
            gmp is not None
            and ipo_price is not None
        ):

            estimated_listing = (
                ipo_price + gmp
            )

        records.append({

            "IPO Name": name,

            "GMP": (
                gmp
                if gmp is not None
                else 0
            ),

            "GMP %": round(
                gmp_percent,
                2
            ),

            "GMP Down": (
                gmp_down
                if gmp_down is not None
                else 0
            ),

            "GMP Up": (
                gmp_up
                if gmp_up is not None
                else 0
            ),

            "Subscription": (
                row.get(
                    subscription_col,
                    ""
                )
                if subscription_col
                else ""
            ),

            "IPO Price": (
                ipo_price
                if ipo_price is not None
                else 0
            ),

            "IPO Size": (
                row.get(
                    ipo_size_col,
                    ""
                )
                if ipo_size_col
                else ""
            ),

            "Lot Size": (
                number(
                    row.get(
                        lot_col,
                        ""
                    )
                )
                if lot_col
                else ""
            ),

            "Open": (
                row.get(
                    open_col,
                    ""
                )
                if open_col
                else ""
            ),

            "Close": (
                row.get(
                    close_col,
                    ""
                )
                if close_col
                else ""
            ),

            "BOA Date": (
                row.get(
                    boa_col,
                    ""
                )
                if boa_col
                else ""
            ),

            "Listing Date": (
                row.get(
                    listing_col,
                    ""
                )
                if listing_col
                else ""
            ),

            "Updated": (
                row.get(
                    updated_col,
                    UPDATED_TIME
                )
                if updated_col
                else UPDATED_TIME
            ),

            "Anchor": (
                row.get(
                    anchor_col,
                    ""
                )
                if anchor_col
                else ""
            ),

            "Estimated Listing Price":
                estimated_listing,

            "Calculated GMP %":
                round(
                    calculated_percent,
                    2
                ),

            "Rating": (
                row.get(
                    rating_col,
                    ""
                )
                if rating_col
                else ""
            )
        })

    return pd.DataFrame(
        records
    )


# ============================================================
# SAVE CURRENT CSV
# ============================================================

def save_current(df):

    if df.empty:
        return

    # --------------------------------------------------------
    # Try sorting by listing date
    # --------------------------------------------------------

    def get_date(value):

        if not value:
            return pd.Timestamp.min

        text = str(value)

        patterns = [
            r"(\d{1,2})[-/](\d{1,2})",
            r"(\d{1,2})[-/]([A-Za-z]{3})"
        ]

        for pattern in patterns:

            match = re.search(
                pattern,
                text
            )

            if not match:
                continue

            try:

                if match.group(2).isdigit():

                    return pd.Timestamp(
                        year=NOW.year,
                        month=int(
                            match.group(2)
                        ),
                        day=int(
                            match.group(1)
                        )
                    )

                month = pd.to_datetime(
                    match.group(2)[:3],
                    format="%b"
                ).month

                return pd.Timestamp(
                    year=NOW.year,
                    month=month,
                    day=int(
                        match.group(1)
                    )
                )

            except Exception:
                pass

        return pd.Timestamp.min

    df["_sort_date"] = (
        df["Listing Date"]
        .apply(get_date)
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
        "✓ Current CSV saved:",
        CURRENT_FILE
    )


# ============================================================
# UPDATE HISTORY
# ============================================================

def update_history(df):

    if df.empty:
        return

    # --------------------------------------------------------
    # Read old history
    # --------------------------------------------------------

    if os.path.exists(
        HISTORY_FILE
    ):

        try:

            history = pd.read_csv(
                HISTORY_FILE
            )

        except Exception:

            history = pd.DataFrame()

    else:

        history = pd.DataFrame()


    # --------------------------------------------------------
    # Current observation
    # --------------------------------------------------------

    new_rows = []

    for _, row in df.iterrows():

        ipo_name = str(
            row["IPO Name"]
        ).strip()

        gmp = float(
            row["GMP"]
        )

        gmp_percent = float(
            row["GMP %"]
        )

        ipo_price = float(
            row["IPO Price"]
        )

        new_rows.append({

            "IPO Name":
                ipo_name,

            "Date":
                TODAY,

            "GMP":
                gmp,

            "GMP %":
                gmp_percent,

            "IPO Price":
                ipo_price,

            "Updated":
                UPDATED_TIME
        })


    new_df = pd.DataFrame(
        new_rows
    )


    # --------------------------------------------------------
    # Combine
    # --------------------------------------------------------

    if history.empty:

        history = new_df

    else:

        history = pd.concat(
            [
                history,
                new_df
            ],
            ignore_index=True
        )


    # --------------------------------------------------------
    # Clean
    # --------------------------------------------------------

    history["IPO Name"] = (
        history["IPO Name"]
        .astype(str)
        .str.strip()
    )

    history["Date"] = (
        history["Date"]
        .astype(str)
        .str.strip()
    )


    # --------------------------------------------------------
    # Numeric fields
    # --------------------------------------------------------

    history["GMP"] = pd.to_numeric(
        history["GMP"],
        errors="coerce"
    ).fillna(0)

    history["GMP %"] = pd.to_numeric(
        history["GMP %"],
        errors="coerce"
    ).fillna(0)

    history["IPO Price"] = pd.to_numeric(
        history["IPO Price"],
        errors="coerce"
    ).fillna(0)


    # --------------------------------------------------------
    # Keep latest observation for each IPO/date
    # --------------------------------------------------------

    history = history.drop_duplicates(
        subset=[
            "IPO Name",
            "Date"
        ],
        keep="last"
    )


    # --------------------------------------------------------
    # Sort by IPO + date
    # --------------------------------------------------------

    history["_date"] = pd.to_datetime(
        history["Date"],
        errors="coerce"
    )

    history = history.sort_values(
        [
            "IPO Name",
            "_date"
        ],
        ascending=[
            True,
            True
        ]
    )

    history = history.drop(
        columns=["_date"]
    )


    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    history.to_csv(
        HISTORY_FILE,
        index=False,
        encoding="utf-8-sig"
    )

    print()
    print(
        "✓ History CSV saved:",
        HISTORY_FILE
    )

    print(
        "History rows:",
        len(history)
    )


# ============================================================
# MAIN
# ============================================================

async def main():

    print()
    print("=" * 90)
    print("IPO GMP SCRAPER")
    print("=" * 90)

    print(
        "Run time:",
        UPDATED_TIME
    )

    rows = await scrape_investorgain()

    if not rows:

        print(
            "❌ No GMP data found."
        )

        return

    print(
        "Scraped rows:",
        len(rows)
    )

    df = create_dataframe(
        rows
    )

    if df.empty:

        print(
            "❌ DataFrame is empty."
        )

        return

    print(
        "IPO records:",
        len(df)
    )

    # Current data
    save_current(df)

    # Historical data
    update_history(df)

    print()
    print("=" * 90)
    print("COMPLETED")
    print("=" * 90)


# ============================================================
# START
# ============================================================

if __name__ == "__main__":

    asyncio.run(
        main()
    )
