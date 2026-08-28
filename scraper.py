import asyncio
import re
import pandas as pd
from playwright.async_api import async_playwright


URL = "https://www.investorgain.com/report/ipo-gmp-live/331/"

OUTPUT_FILE = "output/ipo_gmp_result.csv"


def extract_number(value):
    if value is None:
        return None

    match = re.search(
        r"[-+]?\d+(?:\.\d+)?",
        str(value).replace(",", "")
    )

    if match:
        return float(match.group())

    return None


async def scrape_ipo_gmp():

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

        print("Opening InvestorGain...")

        await page.goto(
            URL,
            wait_until="domcontentloaded",
            timeout=60000
        )

        await page.wait_for_timeout(8000)

        print("Final URL:", page.url)
        print("Title:", await page.title())

        tables = page.locator("table")

        table_count = await tables.count()

        print(
            "Tables found:",
            table_count
        )

        if table_count == 0:
            raise Exception(
                "No GMP table found"
            )

        rows_data = []

        # ------------------------------------------------
        # FIND THE TABLE CONTAINING IPO GMP DATA
        # ------------------------------------------------

        target_table = None

        for i in range(table_count):

            table = tables.nth(i)

            table_text = (
                await table.inner_text()
            ).lower()

            if (
                "gmp" in table_text
                and "ipo size" in table_text
                and "listing" in table_text
            ):

                target_table = table

                print(
                    "Correct GMP table:",
                    i + 1
                )

                break

        if target_table is None:

            raise Exception(
                "Correct GMP table not found"
            )

        rows = await target_table.locator(
            "tr"
        ).all()

        # ------------------------------------------------
        # READ TABLE
        # ------------------------------------------------

        for row in rows:

            cells = await row.locator(
                "th, td"
            ).all_inner_texts()

            cells = [
                c.strip()
                for c in cells
            ]

            if len(cells) >= 10:

                rows_data.append(
                    cells
                )

        if not rows_data:

            raise Exception(
                "No rows found in GMP table"
            )

        # ------------------------------------------------
        # HEADER
        # ------------------------------------------------

        header = [
            "IPO Name",
            "GMP",
            "Rating",
            "Subscription",
            "IPO Price",
            "IPO Size",
            "Lot Size",
            "Open",
            "Close",
            "BOA Date",
            "Listing Date",
            "Updated",
            "Anchor"
        ]

        clean_rows = []

        # ------------------------------------------------
        # PROCESS ROWS
        # ------------------------------------------------

        for row in rows_data:

            if len(row) < 13:
                continue

            name = row[0]

            if name.lower() in [
                "name",
                "ipo name"
            ]:
                continue

            gmp_raw = row[1]

            gmp_match = re.search(
                r"₹?\s*([-+]?\d+(?:\.\d+)?)",
                gmp_raw
            )

            gmp = (
                float(gmp_match.group(1))
                if gmp_match
                else None
            )

            # GMP %
            gmp_percent = None

            percent_match = re.search(
                r"\(([-+]?\d+(?:\.\d+)?)%\)",
                gmp_raw
            )

            if percent_match:

                gmp_percent = float(
                    percent_match.group(1)
                )

            # GMP DOWN / UP
            down = None
            up = None

            movement_match = re.search(
                r"([-+]?\d+(?:\.\d+)?)\s*↓\s*/\s*([-+]?\d+(?:\.\d+)?)\s*↑",
                gmp_raw
            )

            if movement_match:

                down = float(
                    movement_match.group(1)
                )

                up = float(
                    movement_match.group(2)
                )

            # IPO price
            price = extract_number(
                row[4]
            )

            estimated_listing = None

            if (
                gmp is not None
                and price is not None
            ):

                estimated_listing = (
                    price + gmp
                )

            calculated_gmp_percent = None

            if (
                gmp is not None
                and price
                and price != 0
            ):

                calculated_gmp_percent = round(
                    gmp / price * 100,
                    2
                )

            clean_rows.append({

                "IPO Name": name,

                "GMP": gmp,

                "GMP %": gmp_percent,

                "GMP Down": down,

                "GMP Up": up,

                "Subscription": row[3],

                "IPO Price": price,

                "IPO Size": row[5],

                "Lot Size": extract_number(
                    row[6]
                ),

                "Open": row[7],

                "Close": row[8],

                "BOA Date": row[9],

                "Listing Date": row[10],

                "Updated": row[11],

                "Anchor": row[12],

                "Estimated Listing Price":
                    estimated_listing,

                "Calculated GMP %":
                    calculated_gmp_percent,

                "Rating": row[2],

                "Raw GMP": gmp_raw,

                "Raw Price": row[4]
            })

        df = pd.DataFrame(
            clean_rows
        )

        # ------------------------------------------------
        # REMOVE DUPLICATES
        # ------------------------------------------------

        df = df.drop_duplicates(
            subset=["IPO Name"],
            keep="first"
        )

        # ------------------------------------------------
        # SAVE CSV
        # ------------------------------------------------

        import os

        os.makedirs(
            "output",
            exist_ok=True
        )

        df.to_csv(
            OUTPUT_FILE,
            index=False,
            encoding="utf-8-sig"
        )

        print()
        print("=" * 100)
        print("FINAL GMP DATA")
        print("=" * 100)

        print(
            df.to_string(
                index=False
            )
        )

        print()
        print(
            "Saved:",
            OUTPUT_FILE
        )

        await browser.close()


if __name__ == "__main__":

    asyncio.run(
        scrape_ipo_gmp()
    )
