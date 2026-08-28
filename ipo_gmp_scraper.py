# ============================================================
# IPO GMP SCRAPER
# InvestorGain -> CSV + Google Sheets
# Sorted by LATEST UPDATED DATE/TIME first
# ============================================================

import os
import re
import json
import asyncio
from datetime import datetime

import pandas as pd
from playwright.async_api import async_playwright


# ============================================================
# CONFIGURATION
# ============================================================

URL = "https://www.investorgain.com/report/ipo-gmp-live/331/"

CSV_FILE = "ipo_gmp_result.csv"

GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")

SHEET_NAME = "IPO GMP"


# ============================================================
# CLEAN NUMBER
# ============================================================

def extract_number(value):

    if value is None:
        return None

    value = str(value)

    value = (
        value.replace(",", "")
             .replace("₹", "")
             .replace("%", "")
             .strip()
    )

    match = re.search(
        r"-?\d+(?:\.\d+)?",
        value
    )

    if match:
        try:
            return float(match.group())
        except:
            return None

    return None


# ============================================================
# CLEAN GMP
# ============================================================

def parse_gmp(value):

    if value is None:
        return None

    text = str(value).strip()

    # Example:
    # ₹330 (110.00%)
    # 65 ↓ / 330 ↑

    match = re.search(
        r"₹\s*([0-9]+(?:\.[0-9]+)?)",
        text
    )

    if match:
        return float(match.group(1))

    # fallback
    return extract_number(text)


# ============================================================
# PARSE GMP %
# ============================================================

def parse_gmp_percent(value):

    if value is None:
        return None

    text = str(value)

    match = re.search(
        r"\(\s*(-?\d+(?:\.\d+)?)\s*%\s*\)",
        text
    )

    if match:
        return float(match.group(1))

    return None


# ============================================================
# PARSE GMP DOWN / UP
# ============================================================

def parse_gmp_down(value):

    if value is None:
        return None

    text = str(value)

    match = re.search(
        r"([0-9]+(?:\.[0-9]+)?)\s*↓",
        text
    )

    if match:
        return float(match.group(1))

    return 0.0


def parse_gmp_up(value):

    if value is None:
        return None

    text = str(value)

    match = re.search(
        r"([0-9]+(?:\.[0-9]+)?)\s*↑",
        text
    )

    if match:
        return float(match.group(1))

    return 0.0


# ============================================================
# PARSE UPDATED DATE
# ============================================================

def parse_updated(value):

    if value is None:
        return pd.NaT

    text = str(value).strip()

    # InvestorGain format:
    # 27-Aug 23:37
    #
    # Add current year.
    #
    # Example:
    # 27-Aug 23:37
    # -> 2026-08-27 23:37

    try:

        current_year = datetime.now().year

        dt = datetime.strptime(
            f"{text} {current_year}",
            "%d-%b %H:%M %Y"
        )

        return pd.Timestamp(dt)

    except:

        pass

    # fallback
    try:
        return pd.to_datetime(
            value,
            errors="coerce"
        )

    except:
        return pd.NaT


# ============================================================
# SCRAPE DATA
# ============================================================

async def scrape_ipo_gmp():

    print("=" * 80)
    print("OPENING INVESTORGAIN")
    print("=" * 80)

    async with async_playwright() as p:

        browser = await p.chromium.launch(
            headless=True
        )

        page = await browser.new_page(
            viewport={
                "width": 1920,
                "height": 1080
            }
        )

        try:

            await page.goto(
                URL,
                wait_until="domcontentloaded",
                timeout=60000
            )

            await page.wait_for_timeout(8000)

            print("Page loaded:")
            print(page.url)

            # ------------------------------------------------
            # Find tables
            # ------------------------------------------------

            tables = page.locator("table")

            table_count = await tables.count()

            print(
                f"Tables found: {table_count}"
            )

            if table_count == 0:

                raise Exception(
                    "No tables found on InvestorGain."
                )

            # ------------------------------------------------
            # Find correct table
            # ------------------------------------------------

            selected_table = None

            for i in range(table_count):

                table = tables.nth(i)

                text = await table.inner_text()

                if (
                    "GMP" in text
                    and "NAME" in text
                    and "UPDATED-ON" in text
                ):

                    selected_table = table

                    print(
                        f"Correct GMP table found: Table {i + 1}"
                    )

                    break

            if selected_table is None:

                raise Exception(
                    "Correct GMP table not found."
                )

            # ------------------------------------------------
            # Read rows
            # ------------------------------------------------

            rows = selected_table.locator("tr")

            row_count = await rows.count()

            print(
                f"Rows found: {row_count}"
            )

            data = []

            for i in range(row_count):

                row = rows.nth(i)

                cells = await row.locator(
                    "th, td"
                ).all_inner_texts()

                cells = [
                    c.strip()
                    for c in cells
                ]

                # Skip header
                if not cells:
                    continue

                if "NAME" in cells[0].upper():
                    continue

                # InvestorGain GMP table normally has 13 columns.
                if len(cells) < 13:
                    continue

                # ------------------------------------------------
                # Map columns
                # ------------------------------------------------

                name = cells[0]

                raw_gmp = cells[1]

                rating = cells[2]

                subscription = cells[3]

                ipo_price = cells[4]

                ipo_size = cells[5]

                lot_size = cells[6]

                open_date = cells[7]

                close_date = cells[8]

                boa_date = cells[9]

                listing_date = cells[10]

                updated = cells[11]

                anchor = cells[12]

                # ------------------------------------------------
                # GMP
                # ------------------------------------------------

                gmp = parse_gmp(
                    raw_gmp
                )

                gmp_percent = parse_gmp_percent(
                    raw_gmp
                )

                gmp_down = parse_gmp_down(
                    raw_gmp
                )

                gmp_up = parse_gmp_up(
                    raw_gmp
                )

                # ------------------------------------------------
                # Price
                # ------------------------------------------------

                price = extract_number(
                    ipo_price
                )

                # ------------------------------------------------
                # Estimated Listing Price
                # ------------------------------------------------

                estimated_listing_price = None

                if (
                    gmp is not None
                    and price is not None
                ):

                    estimated_listing_price = (
                        price + gmp
                    )

                # ------------------------------------------------
                # Calculated GMP %
                # ------------------------------------------------

                calculated_gmp_percent = None

                if (
                    gmp is not None
                    and price is not None
                    and price != 0
                ):

                    calculated_gmp_percent = (
                        gmp / price * 100
                    )

                # ------------------------------------------------
                # Updated datetime
                # ------------------------------------------------

                updated_datetime = parse_updated(
                    updated
                )

                # ------------------------------------------------
                # Save row
                # ------------------------------------------------

                data.append({

                    "IPO Name": name,

                    "GMP": gmp,

                    "GMP %": gmp_percent,

                    "GMP Down": gmp_down,

                    "GMP Up": gmp_up,

                    "Subscription": subscription,

                    "IPO Price": price,

                    "IPO Size": ipo_size,

                    "Lot Size": extract_number(
                        lot_size
                    ),

                    "Open": open_date,

                    "Close": close_date,

                    "BOA Date": boa_date,

                    "Listing Date": listing_date,

                    "Updated": updated,

                    "Anchor": anchor,

                    "Estimated Listing Price":
                        estimated_listing_price,

                    "Calculated GMP %":
                        calculated_gmp_percent,

                    "Rating": rating,

                    "Raw GMP": raw_gmp,

                    "Updated Datetime":
                        updated_datetime

                })

            # ------------------------------------------------
            # DataFrame
            # ------------------------------------------------

            df = pd.DataFrame(data)

            if df.empty:

                raise Exception(
                    "No IPO GMP rows extracted."
                )

            print(
                f"\nIPO records extracted: {len(df)}"
            )

            # ====================================================
            # SORT BY LATEST UPDATED DATE
            # ====================================================

            df["Updated Datetime"] = pd.to_datetime(
                df["Updated Datetime"],
                errors="coerce"
            )

            df = df.sort_values(
                by="Updated Datetime",
                ascending=False,
                na_position="last"
            ).reset_index(
                drop=True
            )

            # ------------------------------------------------
            # Remove helper datetime column
            # AFTER sorting
            # ------------------------------------------------

            df = df.drop(
                columns=["Updated Datetime"]
            )

            # ------------------------------------------------
            # Round numerical columns
            # ------------------------------------------------

            for column in [
                "GMP",
                "GMP %",
                "GMP Down",
                "GMP Up",
                "IPO Price",
                "Lot Size",
                "Estimated Listing Price",
                "Calculated GMP %"
            ]:

                if column in df.columns:

                    df[column] = pd.to_numeric(
                        df[column],
                        errors="coerce"
                    )

                    df[column] = df[column].round(
                        2
                    )

            # ====================================================
            # DISPLAY
            # ====================================================

            print("\n")
            print("=" * 80)
            print("LATEST IPO GMP DATA")
            print("=" * 80)

            print(
                df[
                    [
                        "IPO Name",
                        "GMP",
                        "GMP %",
                        "IPO Price",
                        "Updated"
                    ]
                ].to_string(
                    index=False
                )
            )

            # ====================================================
            # SAVE CSV
            # ====================================================

            df.to_csv(
                CSV_FILE,
                index=False,
                encoding="utf-8-sig"
            )

            print("\n")
            print("=" * 80)
            print("CSV SAVED")
            print("=" * 80)

            print(
                os.path.abspath(
                    CSV_FILE
                )
            )

            # ====================================================
            # SAVE JSON BACKUP
            # ====================================================

            with open(
                "ipo_gmp_result.json",
                "w",
                encoding="utf-8"
            ) as f:

                json.dump(
                    df.to_dict(
                        orient="records"
                    ),
                    f,
                    indent=2,
                    ensure_ascii=False
                )

            return df

        finally:

            await browser.close()


# ============================================================
# GOOGLE SHEETS
# ============================================================

def upload_to_google_sheet(df):

    if not GOOGLE_SHEET_ID:

        print(
            "\nGOOGLE_SHEET_ID not configured."
        )

        print(
            "CSV was saved successfully."
        )

        return

    if not GOOGLE_SERVICE_ACCOUNT_JSON:

        print(
            "\nGOOGLE_SERVICE_ACCOUNT_JSON not configured."
        )

        print(
            "CSV was saved successfully."
        )

        return

    print("\n")
    print("=" * 80)
    print("UPLOADING TO GOOGLE SHEETS")
    print("=" * 80)

    import gspread
    from google.oauth2.service_account import (
        Credentials
    )

    # ------------------------------------------------
    # Credentials
    # ------------------------------------------------

    service_account_info = json.loads(
        GOOGLE_SERVICE_ACCOUNT_JSON
    )

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
    ]

    credentials = Credentials.from_service_account_info(
        service_account_info,
        scopes=scopes
    )

    client = gspread.authorize(
        credentials
    )

    spreadsheet = client.open_by_key(
        GOOGLE_SHEET_ID
    )

    # ------------------------------------------------
    # Get / create worksheet
    # ------------------------------------------------

    try:

        worksheet = spreadsheet.worksheet(
            SHEET_NAME
        )

    except gspread.WorksheetNotFound:

        worksheet = spreadsheet.add_worksheet(
            title=SHEET_NAME,
            rows=2000,
            cols=30
        )

    # ------------------------------------------------
    # Clear old data
    # ------------------------------------------------

    worksheet.clear()

    # ------------------------------------------------
    # Convert NaN to blank
    # ------------------------------------------------

    upload_df = df.copy()

    upload_df = upload_df.where(
        pd.notnull(upload_df),
        ""
    )

    # ------------------------------------------------
    # Convert values
    # ------------------------------------------------

    values = [
        upload_df.columns.tolist()
    ] + upload_df.astype(str).values.tolist()

    # ------------------------------------------------
    # Upload
    # ------------------------------------------------

    worksheet.update(
        values,
        "A1"
    )

    # ------------------------------------------------
    # Freeze header
    # ------------------------------------------------

    worksheet.freeze(rows=1)

    # ------------------------------------------------
    # Bold header
    # ------------------------------------------------

    worksheet.format(
        "A1:R1",
        {
            "textFormat": {
                "bold": True
            }
        }
    )

    print(
        "Google Sheet updated successfully."
    )

    print(
        f"Worksheet: {SHEET_NAME}"
    )


# ============================================================
# MAIN
# ============================================================

async def main():

    print("\n")
    print("=" * 80)
    print("IPO GMP SCRAPER STARTED")
    print("=" * 80)

    try:

        df = await scrape_ipo_gmp()

        upload_to_google_sheet(
            df
        )

        print("\n")
        print("=" * 80)
        print("PROCESS COMPLETED SUCCESSFULLY")
        print("=" * 80)

    except Exception as e:

        print("\n")
        print("=" * 80)
        print("ERROR")
        print("=" * 80)

        print(
            repr(e)
        )

        raise


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    asyncio.run(
        main()
    )
