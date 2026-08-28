import asyncio
import re
import os
import json
from datetime import datetime

import pandas as pd
from playwright.async_api import async_playwright


# ============================================================
# CONFIGURATION
# ============================================================

URL = "https://www.investorgain.com/report/live-ipo-gmp/331/ipo/"

OUTPUT_FILE = "ipo_gmp_result.csv"


# ============================================================
# HELPERS
# ============================================================

def clean_text(value):
    if value is None:
        return ""

    value = str(value)

    value = value.replace("\xa0", " ")
    value = value.replace("\r", " ")
    value = value.replace("\n", " ")

    value = re.sub(r"\s+", " ", value)

    return value.strip()


def extract_number(value):

    if value is None:
        return None

    text = clean_text(value)

    text = text.replace(",", "")
    text = text.replace("₹", "")
    text = text.replace("%", "")
    text = text.replace("x", "")

    match = re.search(
        r"-?\d+(?:\.\d+)?",
        text
    )

    if match:
        try:
            return float(match.group())
        except:
            return None

    return None


def extract_gmp(value):

    if value is None:
        return None

    text = clean_text(value)

    # Example:
    # ₹330 (110.00%) 65 ↓ / 330 ↑

    match = re.search(
        r"₹\s*(-?\d+(?:\.\d+)?)",
        text
    )

    if match:
        return float(match.group(1))

    # fallback
    return extract_number(text)


def extract_gmp_percentage(value):

    if value is None:
        return None

    text = clean_text(value)

    match = re.search(
        r"\(\s*(-?\d+(?:\.\d+)?)\s*%\s*\)",
        text
    )

    if match:
        return float(match.group(1))

    return None


def extract_down_up(value):

    if value is None:
        return None, None

    text = clean_text(value)

    # Example:
    # ₹330 (110.00%) 65 ↓ / 330 ↑

    match = re.search(
        r"(-?\d+(?:\.\d+)?)\s*↓\s*/\s*(-?\d+(?:\.\d+)?)\s*↑",
        text
    )

    if match:

        return (
            float(match.group(1)),
            float(match.group(2))
        )

    return None, None


def extract_name(value):

    if value is None:
        return ""

    text = clean_text(value)

    # Remove status suffixes that InvestorGain may append
    text = re.sub(
        r"(IPOCALLOTTED|IPOALLOTTED)$",
        "",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"(IPO)$",
        "",
        text,
        flags=re.IGNORECASE
    )

    return text.strip()


# ============================================================
# MAIN SCRAPER
# ============================================================

async def scrape_gmp():

    print("=" * 100)
    print("IPO GMP SCRAPER")
    print("=" * 100)

    print("Opening InvestorGain...")

    async with async_playwright() as p:

        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage"
            ]
        )

        page = await browser.new_page(
            viewport={
                "width": 1920,
                "height": 1080
            }
        )

        # ----------------------------------------------------
        # OPEN PAGE
        # ----------------------------------------------------

        await page.goto(
            URL,
            wait_until="domcontentloaded",
            timeout=60000
        )

        await page.wait_for_timeout(8000)

        print("Final URL:")
        print(page.url)

        print("Title:")
        print(await page.title())

        # ----------------------------------------------------
        # FIND TABLE
        # ----------------------------------------------------

        tables = page.locator("table")

        table_count = await tables.count()

        print()
        print("Tables found:", table_count)

        if table_count == 0:

            print("ERROR: No tables found.")

            await browser.close()

            return None

        # ----------------------------------------------------
        # FIND TABLE CONTAINING GMP
        # ----------------------------------------------------

        target_table = None

        for i in range(table_count):

            table = tables.nth(i)

            table_text = clean_text(
                await table.inner_text()
            )

            if (
                "GMP" in table_text
                and "PRICE" in table_text
                and "IPO SIZE" in table_text
            ):

                target_table = table

                print(
                    "Correct GMP table found:",
                    i + 1
                )

                break

        if target_table is None:

            print(
                "ERROR: Correct GMP table not found."
            )

            # Save diagnostic HTML
            html = await page.content()

            with open(
                "debug_investorgain.html",
                "w",
                encoding="utf-8"
            ) as f:

                f.write(html)

            await browser.close()

            return None

        # ----------------------------------------------------
        # READ ROWS
        # ----------------------------------------------------

        rows = target_table.locator("tr")

        row_count = await rows.count()

        print(
            "Rows found:",
            row_count
        )

        records = []

        # ----------------------------------------------------
        # PROCESS EVERY ROW
        # ----------------------------------------------------

        for i in range(row_count):

            row = rows.nth(i)

            cells = await row.locator(
                "th, td"
            ).all_inner_texts()

            cells = [
                clean_text(x)
                for x in cells
            ]

            # Need at least 13 columns
            if len(cells) < 13:
                continue

            # Skip header
            if "NAME" in cells[0].upper():
                continue

            try:

                name_raw = cells[0]

                if not name_raw:
                    continue

                name = extract_name(
                    name_raw
                )

                # ------------------------------------------------
                # COLUMN MAPPING
                # ------------------------------------------------

                gmp_raw = cells[1]

                rating = cells[2]

                subscription = cells[3]

                ipo_price_raw = cells[4]

                ipo_size = cells[5]

                lot_size_raw = cells[6]

                open_date = cells[7]

                close_date = cells[8]

                boa_date = cells[9]

                listing_date = cells[10]

                updated = cells[11]

                anchor = cells[12]

                # ------------------------------------------------
                # GMP
                # ------------------------------------------------

                gmp = extract_gmp(
                    gmp_raw
                )

                website_gmp_percentage = (
                    extract_gmp_percentage(
                        gmp_raw
                    )
                )

                gmp_down, gmp_up = (
                    extract_down_up(
                        gmp_raw
                    )
                )

                # ------------------------------------------------
                # PRICE
                # ------------------------------------------------

                ipo_price = extract_number(
                    ipo_price_raw
                )

                # ------------------------------------------------
                # LOT SIZE
                # ------------------------------------------------

                lot_size = extract_number(
                    lot_size_raw
                )

                # ------------------------------------------------
                # SUBSCRIPTION
                # ------------------------------------------------

                subscription_numeric = (
                    extract_number(
                        subscription
                    )
                )

                # ------------------------------------------------
                # CALCULATIONS
                # ------------------------------------------------

                estimated_listing_price = None

                calculated_gmp_percentage = None

                if (
                    gmp is not None
                    and ipo_price is not None
                ):

                    estimated_listing_price = (
                        ipo_price + gmp
                    )

                    if ipo_price != 0:

                        calculated_gmp_percentage = (
                            gmp /
                            ipo_price *
                            100
                        )

                # ------------------------------------------------
                # RECORD
                # ------------------------------------------------

                record = {

                    "IPO Name":
                        name,

                    "GMP":
                        gmp,

                    "GMP %":
                        website_gmp_percentage,

                    "GMP Down":
                        gmp_down,

                    "GMP Up":
                        gmp_up,

                    "Subscription":
                        subscription_numeric,

                    "IPO Price":
                        ipo_price,

                    "IPO Size":
                        ipo_size,

                    "Lot Size":
                        lot_size,

                    "Open":
                        open_date,

                    "Close":
                        close_date,

                    "BOA Date":
                        boa_date,

                    "Listing Date":
                        listing_date,

                    "Updated":
                        updated,

                    "Anchor":
                        anchor,

                    "Estimated Listing Price":
                        estimated_listing_price,

                    "Calculated GMP %":
                        (
                            round(
                                calculated_gmp_percentage,
                                2
                            )
                            if calculated_gmp_percentage
                            is not None
                            else None
                        ),

                    "Rating":
                        rating,

                    "Raw GMP":
                        gmp_raw,

                    "Raw Price":
                        ipo_price_raw,

                    "Scraped At":
                        datetime.now().strftime(
                            "%Y-%m-%d %H:%M:%S"
                        )
                }

                records.append(
                    record
                )

            except Exception as e:

                print(
                    "Row error:",
                    e
                )

        # ----------------------------------------------------
        # CLOSE BROWSER
        # ----------------------------------------------------

        await browser.close()

        # ----------------------------------------------------
        # DATAFRAME
        # ----------------------------------------------------

        if not records:

            print(
                "ERROR: No IPO records found."
            )

            return None

        df = pd.DataFrame(
            records
        )

        # ----------------------------------------------------
        # REMOVE DUPLICATES
        # ----------------------------------------------------

        df = df.drop_duplicates(
            subset=["IPO Name"],
            keep="first"
        )

        # ----------------------------------------------------
        # SORT
        # ----------------------------------------------------

        df = df.sort_values(
            by="IPO Name"
        ).reset_index(
            drop=True
        )

        # ----------------------------------------------------
        # SAVE CSV
        # ----------------------------------------------------

        df.to_csv(
            OUTPUT_FILE,
            index=False,
            encoding="utf-8-sig"
        )

        # ----------------------------------------------------
        # DISPLAY
        # ----------------------------------------------------

        print()
        print("=" * 100)
        print("FINAL RESULT")
        print("=" * 100)

        print(
            "Total IPOs:",
            len(df)
        )

        print()

        print(
            df[
                [
                    "IPO Name",
                    "GMP",
                    "GMP %",
                    "GMP Down",
                    "GMP Up",
                    "Subscription",
                    "IPO Price",
                    "Estimated Listing Price",
                    "Calculated GMP %",
                    "Rating"
                ]
            ].to_string(
                index=False
            )
        )

        print()
        print("=" * 100)
        print(
            "Saved CSV:",
            OUTPUT_FILE
        )
        print("=" * 100)

        return df


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    asyncio.run(
        scrape_gmp()
    )
