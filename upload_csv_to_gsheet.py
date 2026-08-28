import os
import json
import pandas as pd
import gspread
from google.oauth2.service_account import Credentials


# ============================================================
# CONFIGURATION
# ============================================================

CSV_FILE = "ipo_gmp_result.csv"

# Google Sheet ID
GOOGLE_SHEET_ID = os.environ.get("d/1tm5cNsuOmPL1372mmatcrrlYxsUB-TFtltm0Lh5yZwo/edit?gid=11103552#gid=11103552")

# Sheet/tab name
WORKSHEET_NAME = "IPO ANALYSIS DASHBOARD"


# ============================================================
# CHECK FILES / VARIABLES
# ============================================================

if not os.path.exists(CSV_FILE):
    raise FileNotFoundError(
        f"CSV file not found: {CSV_FILE}"
    )

if not GOOGLE_SHEET_ID:
    raise ValueError(
        "GOOGLE_SHEET_ID environment variable is missing."
    )

GOOGLE_SERVICE_ACCOUNT_JSON = os.environ.get(
    "GOOGLE_SERVICE_ACCOUNT_JSON"
)

if not GOOGLE_SERVICE_ACCOUNT_JSON:
    raise ValueError(
        "GOOGLE_SERVICE_ACCOUNT_JSON environment variable is missing."
    )


# ============================================================
# READ CSV
# ============================================================

print("=" * 80)
print("READING CSV")
print("=" * 80)

df = pd.read_csv(CSV_FILE)

print(f"CSV file: {CSV_FILE}")
print(f"Rows found: {len(df)}")
print(f"Columns found: {len(df.columns)}")

print("\nColumns:")
print(list(df.columns))


# ============================================================
# CLEAN DATA
# ============================================================

# Replace NaN / infinity values because Google Sheets
# does not handle them reliably.

df = df.replace(
    [float("inf"), float("-inf")],
    ""
)

df = df.fillna("")


# Convert everything to strings/numbers that Sheets accepts
data = [df.columns.tolist()] + df.values.tolist()


# ============================================================
# GOOGLE AUTHENTICATION
# ============================================================

print("\n" + "=" * 80)
print("CONNECTING TO GOOGLE SHEETS")
print("=" * 80)

try:

    # The GitHub Secret contains the complete service
    # account JSON.

    service_account_info = json.loads(
        GOOGLE_SERVICE_ACCOUNT_JSON
    )

except json.JSONDecodeError as e:

    raise ValueError(
        "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON."
    ) from e


SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]


credentials = Credentials.from_service_account_info(
    service_account_info,
    scopes=SCOPES
)


client = gspread.authorize(credentials)


# ============================================================
# OPEN GOOGLE SHEET
# ============================================================

print("Opening Google Sheet...")

spreadsheet = client.open_by_key(
    GOOGLE_SHEET_ID
)

print(
    "Spreadsheet:",
    spreadsheet.title
)


# ============================================================
# GET / CREATE WORKSHEET
# ============================================================

try:

    worksheet = spreadsheet.worksheet(
        WORKSHEET_NAME
    )

    print(
        f"Worksheet found: {WORKSHEET_NAME}"
    )

except gspread.WorksheetNotFound:

    print(
        f"Worksheet not found. Creating: {WORKSHEET_NAME}"
    )

    worksheet = spreadsheet.add_worksheet(
        title=WORKSHEET_NAME,
        rows=max(len(data) + 10, 100),
        cols=max(len(df.columns) + 5, 30)
    )


# ============================================================
# CLEAR OLD DATA
# ============================================================

print("\nClearing old Google Sheet data...")

worksheet.clear()


# ============================================================
# RESIZE WORKSHEET IF NECESSARY
# ============================================================

required_rows = max(
    len(data) + 5,
    100
)

required_cols = max(
    len(df.columns) + 5,
    30
)

try:

    worksheet.resize(
        rows=required_rows,
        cols=required_cols
    )

except Exception as e:

    print(
        "Resize warning:",
        e
    )


# ============================================================
# UPLOAD CSV DATA
# ============================================================

print("\nUploading CSV to Google Sheets...")

worksheet.update(
    range_name="A1",
    values=data,
    value_input_option="USER_ENTERED"
)


# ============================================================
# FORMAT HEADER
# ============================================================

print("Formatting header...")

try:

    worksheet.format(
        "A1:{}".format(
            gspread.utils.rowcol_to_a1(
                1,
                len(df.columns)
            )
        ),
        {
            "textFormat": {
                "bold": True
            },
            "horizontalAlignment": "CENTER",
            "verticalAlignment": "MIDDLE"
        }
    )

except Exception as e:

    print(
        "Header formatting warning:",
        e
    )


# ============================================================
# FREEZE HEADER
# ============================================================

try:

    worksheet.freeze(
        rows=1
    )

except Exception as e:

    print(
        "Freeze warning:",
        e
    )


# ============================================================
# AUTO RESIZE COLUMNS
# ============================================================

print("Resizing columns...")

try:

    for col in range(
        1,
        len(df.columns) + 1
    ):

        worksheet.columns_auto_resize(
            col - 1,
            col
        )

except Exception as e:

    print(
        "Auto resize warning:",
        e
    )


# ============================================================
# FINAL RESULT
# ============================================================

print("\n" + "=" * 80)
print("UPLOAD SUCCESSFUL")
print("=" * 80)

print(
    f"Rows uploaded: {len(df)}"
)

print(
    f"Columns uploaded: {len(df.columns)}"
)

print(
    f"Google Sheet: {spreadsheet.title}"
)

print(
    f"Worksheet: {WORKSHEET_NAME}"
)

print("=" * 80)
