import asyncio
import re
import pandas as pd
from playwright.async_api import async_playwright


# ============================================================
# CONFIGURATION
# ============================================================

URL = "https://www.investorgain.com/report/live-ipo-gmp/331/"

OUTPUT_FILE = "ipo_gmp_result.csv"

HEADLESS = True

WAIT_TIME = 8000


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clean_text(value):
    """Clean whitespace and invisible characters."""

    if value is None:
        return ""

    value = str(value)

    value = value.replace("\xa0", " ")

    value = re.sub(
        r"\s+",
        " ",
        value
    )

    return value.strip()


# ------------------------------------------------------------
# Extract first number
# ------------------------------------------------------------

def extract_number(value):

    if value is None:
        return None

    value = str(value)

    value = value.replace(",", "")

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


# ------------------------------------------------------------
# Extract GMP information
# ------------------------------------------------------------

def extract_gmp(value):

    value = clean_text(value)

    # Example:
    #
    # ₹330 (110.00%)
    # 65 ↓ / 330 ↑
    #
    # GMP = 330
    # GMP % = 110.00
    # Down = 65
    # Up = 330

    gmp = None
    gmp_percent = None
    gmp_down = None
    gmp_up = None

    # GMP main value
    match = re.search(
        r"₹\s*([\d,.]+)",
        value
    )

    if match:

        try:
            gmp = float(
                match.group(1).replace(",", "")
            )
        except:
            pass

    # GMP percentage
    match = re.search(
        r"\(([-+]?\d+(?:\.\d+)?)%\)",
        value
    )

    if match:

        try:
            gmp_percent = float(
                match.group(1)
            )
        except:
            pass

    # Down / Up
    match = re.search(
        r"([\d,.]+)\s*↓\s*/\s*([\d,.]+)\s*↑",
        value
    )

    if match:

        try:
            gmp_down = float(
                match.group(1).replace(",", "")
            )
        except:
            pass

        try:
            gmp_up = float(
                match.group(2).replace(",", "")
            )
        except:
            pass

    return (
        gmp,
        gmp_percent,
        gmp_down,
        gmp_up
    )


# ------------------------------------------------------------
# Extract subscription
# ------------------------------------------------------------

def extract_subscription(value):

    value = clean_text(value)

    if value in ["-", "--", ""]:
        return None

    match = re.search(
        r"([\d,.]+)\s*x",
        value,
        re.IGNORECASE
    )

    if match:

        try:

            return float(
                match.group(1).replace(",", "")
            )

        except:
            return None

    return None


# ------------------------------------------------------------
# Extract price
# ------------------------------------------------------------

def extract_price(value):

    value = clean_text(value)

    if value in ["-", "--", ""]:
        return None

    return extract_number(value)


# ------------------------------------------------------------
# Clean IPO name
# ------------------------------------------------------------

def clean_ipo_name(value):

    value = clean_text(value)

    # Remove trailing status characters
    value = re.sub(
        r"(?:IPO)?\s*CALLOTTED$",
        "",
        value,
        flags=re.IGNORECASE
    )

    # Remove trailing U/O markers
    value = re.sub(
        r"\s+[UO]$",
        "",
        value
    )

    return value.strip()


# ------------------------------------------------------------
# Extract date
# ------------------------------------------------------------

def extract_date(value):

    value = clean_text(value)

    if not value:
        return ""

    # Keep only the date portion before GMP
    value = value.split("GMP")[0]

    return value.strip()


# ------------------------------------------------------------
# Convert date to sortable date
# ------------------------------------------------------------

def date_for_sort(value):

    if value is None:
        return pd.NaT

    value = str(value).strip()

    if not value:
        return pd.NaT

    # Remove GMP text
    value = value.split("GMP")[0].strip()

    # Remove possible year if present
    value = re.sub(
        r"\b\d{4}\b",
        "",
        value
    ).strip()

    try:

        # Current year
        current_year = pd.Timestamp.now().year

        return pd.to_datetime(
            f"{value}-{current_year}",
            format="%d-%b-%Y",
            errors="coerce"
        )

    except:

        return pd.NaT


# ============================================================
# SCRAPER
# ============================================================

async def scrape_ipo_gmp():

    print("=" * 100)
    print("IPO GMP SCRAPER")
    print("=" * 100)

    print("\nOpening InvestorGain...")

    async with async_playwright() as p:

        browser = await p.chromium.launch(
            headless=HEADLESS
        )

        page = await browser.new_page(
            viewport={
                "width": 1920,
                "height": 1080
            }
        )

        # ----------------------------------------------------
        # Open page
        # ----------------------------------------------------

        try:

            await page.goto(
                URL,
                wait_until="domcontentloaded",
                timeout=60000
            )

        except Exception as e:

            print(
                "Page loading warning:",
                e
            )

        await page.wait_for_timeout(
            WAIT_TIME
        )

        print(
            "Final URL:",
            page.url
        )

        print(
            "Page title:",
            await page.title()
        )

        # ----------------------------------------------------
        # Find tables
        # ----------------------------------------------------

        tables = page.locator("table")

        table_count = await tables.count()

        print(
            f"\nTables found: {table_count}"
        )

        if table_count == 0:

            await browser.close()

            raise RuntimeError(
                "No tables found on InvestorGain."
            )

        # ----------------------------------------------------
        # Find correct GMP table
        # ----------------------------------------------------

        correct_table = None

        for i in range(table_count):

            table = tables.nth(i)

            try:

                table_text = clean_text(
                    await table.inner_text()
                )

            except:

                continue

            # The correct table normally contains
            # several of these fields.

            score = 0

            if "GMP" in table_text:
                score += 3

            if "NAME" in table_text.upper():
                score += 2

            if "PRICE" in table_text.upper():
                score += 2

            if "LISTING" in table_text.upper():
                score += 2

            if "IPO" in table_text.upper():
                score += 1

            if score >= 5:

                correct_table = table

                print(
                    f"Correct GMP table found: Table {i + 1}"
                )

                break

        if correct_table is None:

            await browser.close()

            raise RuntimeError(
                "Correct GMP table not found."
            )

        # ----------------------------------------------------
        # Read rows
        # ----------------------------------------------------

        rows = correct_table.locator("tr")

        row_count = await rows.count()

        print(
            f"Rows found: {row_count}"
        )

        records = []

        # ----------------------------------------------------
        # Process rows
        # ----------------------------------------------------

        for row_index in range(
            row_count
        ):

            row = rows.nth(
                row_index
            )

            try:

                cells = await row.locator(
                    "th, td"
                ).all_inner_texts()

            except:

                continue

            cells = [
                clean_text(x)
                for x in cells
            ]

            # Need at least 10 columns
            if len(cells) < 10:
                continue

            # Skip header
            first_cell = cells[0].upper()

            if (
                "NAME" in first_cell
                or first_cell == ""
            ):
                continue

            # ------------------------------------------------
            # Expected columns
            #
            # 0 NAME
            # 1 GMP
            # 2 RATING
            # 3 SUB
            # 4 PRICE
            # 5 IPO SIZE
            # 6 LOT
            # 7 OPEN
            # 8 CLOSE
            # 9 BOA DT
            # 10 LISTING
            # 11 UPDATED
            # 12 ANCHOR
            # ------------------------------------------------

            try:

                name_raw = cells[0]

                gmp_raw = cells[1]

                rating = cells[2]

                subscription_raw = cells[3]

                price_raw = cells[4]

                ipo_size = cells[5]

                lot_raw = cells[6]

                open_raw = cells[7]

                close_raw = cells[8]

                boa_date = cells[9]

                listing_date = cells[10]

                updated = cells[11]

                anchor = cells[12]

            except IndexError:

                continue

            # ------------------------------------------------
            # Clean IPO name
            # ------------------------------------------------

            name = clean_ipo_name(
                name_raw
            )

            if not name:
                continue

            # ------------------------------------------------
            # GMP
            # ------------------------------------------------

            (
                gmp,
                website_gmp_percent,
                gmp_down,
                gmp_up
            ) = extract_gmp(
                gmp_raw
            )

            # ------------------------------------------------
            # Subscription
            # ------------------------------------------------

            subscription = (
                extract_subscription(
                    subscription_raw
                )
            )

            # ------------------------------------------------
            # IPO price
            # ------------------------------------------------

            ipo_price = extract_price(
                price_raw
            )

            # ------------------------------------------------
            # Lot size
            # ------------------------------------------------

            lot_size = extract_number(
                lot_raw
            )

            # ------------------------------------------------
            # Dates
            # ------------------------------------------------

            open_date = extract_date(
                open_raw
            )

            close_date = extract_date(
                close_raw
            )

            listing_date = extract_date(
                listing_date
            )

            # ------------------------------------------------
            # Estimated listing price
            # ------------------------------------------------

            estimated_listing_price = None

            if (
                gmp is not None
                and ipo_price is not None
            ):

                estimated_listing_price = (
                    ipo_price + gmp
                )

            # ------------------------------------------------
            # Calculated GMP %
            # ------------------------------------------------

            calculated_gmp_percent = None

            if (
                gmp is not None
                and ipo_price is not None
                and ipo_price != 0
            ):

                calculated_gmp_percent = (
                    gmp /
                    ipo_price *
                    100
                )

            # ------------------------------------------------
            # Save record
            # ------------------------------------------------

            records.append({

                "IPO Name": name,

                "GMP": gmp,

                "GMP %": website_gmp_percent,

                "GMP Down": gmp_down,

                "GMP Up": gmp_up,

                "Subscription": subscription,

                "IPO Price": ipo_price,

                "IPO Size": ipo_size,

                "Lot Size": lot_size,

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

                "Raw GMP": gmp_raw,

                "Raw Price": price_raw

            })

        await browser.close()

        # ====================================================
        # CHECK RESULTS
        # ====================================================

        print("\n" + "=" * 100)
        print("SCRAPING RESULT")
        print("=" * 100)

        print(
            "Total IPOs found:",
            len(records)
        )

        if not records:

            raise RuntimeError(
                "No IPO GMP records extracted."
            )

        # ====================================================
        # CREATE DATAFRAME
        # ====================================================

        df = pd.DataFrame(
            records
        )

        # ====================================================
        # REMOVE DUPLICATES
        # ====================================================

        df = df.drop_duplicates(
            subset=["IPO Name"],
            keep="first"
        )

        # ====================================================
        # ROUND NUMBERS
        # ====================================================

        numeric_columns = [

            "GMP",
            "GMP %",
            "GMP Down",
            "GMP Up",
            "Subscription",
            "IPO Price",
            "Lot Size",
            "Estimated Listing Price",
            "Calculated GMP %"

        ]

        for column in numeric_columns:

            if column in df.columns:

                df[column] = pd.to_numeric(
                    df[column],
                    errors="coerce"
                )

        df["GMP"] = df["GMP"].round(2)

        df["GMP %"] = df["GMP %"].round(2)

        df["GMP Down"] = (
            df["GMP Down"].round(2)
        )

        df["GMP Up"] = (
            df["GMP Up"].round(2)
        )

        df["Subscription"] = (
            df["Subscription"].round(2)
        )

        df["IPO Price"] = (
            df["IPO Price"].round(2)
        )

        df["Lot Size"] = (
            df["Lot Size"].round(2)
        )

        df["Estimated Listing Price"] = (
            df[
                "Estimated Listing Price"
            ].round(2)
        )

        df["Calculated GMP %"] = (
            df[
                "Calculated GMP %"
            ].round(2)
        )

        # ====================================================
        # SORT BY LISTING DATE
        # ====================================================

        df["_ListingSort"] = (
            df["Listing Date"]
            .apply(date_for_sort)
        )

        df["_CloseSort"] = (
            df["Close"]
            .apply(date_for_sort)
        )

        df["_OpenSort"] = (
            df["Open"]
            .apply(date_for_sort)
        )

        # ----------------------------------------------------
        # Upcoming dates first
        # ----------------------------------------------------

        df = df.sort_values(

            by=[
                "_ListingSort",
                "_CloseSort",
                "_OpenSort"
            ],

            ascending=[
                True,
                True,
                True
            ],

            na_position="last"

        )

        # ====================================================
        # REMOVE SORT COLUMNS
        # ====================================================

        df = df.drop(
            columns=[
                "_ListingSort",
                "_CloseSort",
                "_OpenSort"
            ],
            errors="ignore"
        )

        # ====================================================
        # RESET INDEX
        # ====================================================

        df = df.reset_index(
            drop=True
        )

        # ====================================================
        # SAVE CSV
        # ====================================================

        df.to_csv(
            OUTPUT_FILE,
            index=False,
            encoding="utf-8-sig"
        )

        # ====================================================
        # DISPLAY RESULT
        # ====================================================

        print("\n" + "=" * 100)
        print("FINAL IPO GMP DATA")
        print("=" * 100)

        display_columns = [

            "IPO Name",
            "GMP",
            "GMP %",
            "GMP Down",
            "GMP Up",
            "Subscription",
            "IPO Price",
            "IPO Size",
            "Lot Size",
            "Open",
            "Close",
            "BOA Date",
            "Listing Date",
            "Updated",
            "Anchor",
            "Estimated Listing Price",
            "Calculated GMP %",
            "Rating"

        ]

        print(
            df[
                display_columns
            ].to_string(
                index=False
            )
        )

        # ====================================================
        # SUMMARY
        # ====================================================

        print("\n" + "=" * 100)
        print("SUMMARY")
        print("=" * 100)

        print(
            "Total IPOs:",
            len(df)
        )

        print(
            "CSV file:",
            OUTPUT_FILE
        )

        print(
            "CSV saved successfully."
        )

        return df


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    asyncio.run(
        scrape_ipo_gmp()
    )
