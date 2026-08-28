```javascript
// ============================================================
// IPO GMP ANALYSIS DASHBOARD
// script.js
// ============================================================

"use strict";


// ============================================================
// CONFIGURATION
// ============================================================

const CURRENT_CSV = "ipo_gmp_result.csv";
const HISTORY_CSV = "ipo_gmp_history.csv";

const AUTO_REFRESH_MINUTES = 5;


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let currentData = [];
let historyData = [];
let gmpChart = null;


// ============================================================
// DOM ELEMENTS
// ============================================================

const ipoSelect =
    document.getElementById("ipoSelect");

const searchBox =
    document.getElementById("searchBox");

const tableBody =
    document.getElementById("ipoTableBody");

const statusBox =
    document.getElementById("status");

const chartTitle =
    document.getElementById("chartTitle");

const chartCanvas =
    document.getElementById("gmpChart");


// ============================================================
// PAGE INITIALIZATION
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "IPO GMP Dashboard starting..."
        );

        loadDashboard();

    }
);


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    try {

        setStatus(
            "Loading IPO GMP data..."
        );


        // ----------------------------------------------------
        // Load current CSV
        // ----------------------------------------------------

        currentData =
            await loadCSV(
                CURRENT_CSV
            );


        console.log(
            "Current IPO records:",
            currentData.length
        );


        // ----------------------------------------------------
        // Load historical CSV
        // ----------------------------------------------------

        try {

            historyData =
                await loadCSV(
                    HISTORY_CSV
                );

            console.log(
                "Historical records:",
                historyData.length
            );

        } catch (error) {

            console.warn(
                "History CSV not available:",
                error
            );

            historyData = [];

        }


        // ----------------------------------------------------
        // Clean current data
        // ----------------------------------------------------

        currentData =
            cleanCurrentData(
                currentData
            );


        // ----------------------------------------------------
        // Sort latest listing date first
        // ----------------------------------------------------

        currentData.sort(
            compareListingDateDescending
        );


        // ----------------------------------------------------
        // Clean history
        // ----------------------------------------------------

        historyData =
            cleanHistoryData(
                historyData
            );


        // ----------------------------------------------------
        // Dropdown
        // ----------------------------------------------------

        populateIPODropdown();


        // ----------------------------------------------------
        // Current table
        // ----------------------------------------------------

        renderTable(
            currentData
        );


        // ----------------------------------------------------
        // Status
        // ----------------------------------------------------

        setStatus(
            `${currentData.length} IPOs loaded`
        );


        // ----------------------------------------------------
        // Restore previously selected IPO
        // ----------------------------------------------------

        const savedIPO =
            localStorage.getItem(
                "selectedIPO"
            );


        if (
            savedIPO &&
            currentData.some(
                ipo =>
                    ipo["IPO Name"] ===
                    savedIPO
            )
        ) {

            ipoSelect.value =
                savedIPO;

            drawGMPChart(
                savedIPO
            );
        }


    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        setStatus(
            "❌ Unable to load IPO data. Check CSV files."
        );

    }

}


// ============================================================
// LOAD CSV
// ============================================================

async function loadCSV(
    file
) {

    const response =
        await fetch(
            file +
            "?v=" +
            Date.now()
        );


    if (!response.ok) {

        throw new Error(
            `HTTP ${response.status}: ${file}`
        );

    }


    const text =
        await response.text();


    if (
        !text ||
        text.trim() === ""
    ) {

        return [];

    }


    return parseCSV(
        text
    );

}


// ============================================================
// CSV PARSER
// ============================================================

function parseCSV(
    text
) {

    const rows = [];

    let row = [];

    let cell = "";

    let insideQuotes = false;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const char =
            text[i];


        // ----------------------------------------------------
        // Quote
        // ----------------------------------------------------

        if (
            char === '"'
        ) {

            if (
                insideQuotes &&
                text[i + 1] === '"'
            ) {

                cell += '"';

                i++;

            } else {

                insideQuotes =
                    !insideQuotes;

            }

        }


        // ----------------------------------------------------
        // Comma
        // ----------------------------------------------------

        else if (
            char === "," &&
            !insideQuotes
        ) {

            row.push(
                cell
            );

            cell = "";

        }


        // ----------------------------------------------------
        // New line
        // ----------------------------------------------------

        else if (
            (
                char === "\n" ||
                char === "\r"
            ) &&
            !insideQuotes
        ) {

            if (
                char === "\r" &&
                text[i + 1] === "\n"
            ) {

                i++;

            }


            row.push(
                cell
            );

            cell = "";


            if (
                row.some(
                    value =>
                        String(
                            value
                        ).trim() !== ""
                )
            ) {

                rows.push(
                    row
                );

            }


            row = [];

        }


        // ----------------------------------------------------
        // Normal character
        // ----------------------------------------------------

        else {

            cell += char;

        }

    }


    // --------------------------------------------------------
    // Last row
    // --------------------------------------------------------

    if (
        cell.length > 0 ||
        row.length > 0
    ) {

        row.push(
            cell
        );

        if (
            row.some(
                value =>
                    String(
                        value
                    ).trim() !== ""
            )
        ) {

            rows.push(
                row
            );

        }

    }


    if (
        rows.length === 0
    ) {

        return [];

    }


    // --------------------------------------------------------
    // Headers
    // --------------------------------------------------------

    const headers =
        rows[0].map(
            header =>
                cleanText(
                    header
                )
        );


    // --------------------------------------------------------
    // Objects
    // --------------------------------------------------------

    const data =
        rows
            .slice(1)
            .map(
                row => {

                    const obj = {};

                    headers.forEach(
                        (
                            header,
                            index
                        ) => {

                            obj[header] =
                                cleanText(
                                    row[index] ||
                                    ""
                                );

                        }
                    );

                    return obj;

                }
            );


    return data;

}


// ============================================================
// CLEAN TEXT
// ============================================================

function cleanText(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(
        value
    )
        .replace(
            /\uFEFF/g,
            ""
        )
        .replace(
            /\u00A0/g,
            " "
        )
        .trim();

}


// ============================================================
// NUMBER CONVERTER
// ============================================================

function toNumber(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return 0;

    }


    const number =
        parseFloat(
            String(
                value
            )
                .replace(
                    /,/g,
                    ""
                )
                .replace(
                    /₹/g,
                    ""
                )
                .replace(
                    /%/g,
                    ""
                )
                .replace(
                    /x/gi,
                    ""
                )
                .trim()
        );


    return isNaN(
        number
    )
        ? 0
        : number;

}


// ============================================================
// PARSE DATE
// ============================================================

function parseDate(
    value
) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {

        return null;

    }


    let text =
        String(
            value
        )
            .trim();


    // --------------------------------------------------------
    // Remove extra text
    //
    // Examples:
    // "28-Aug GMP: 270"
    // "28-Aug"
    // --------------------------------------------------------

    text =
        text
            .replace(
                /GMP\s*:.*$/i,
                ""
            )
            .trim();


    // --------------------------------------------------------
    // YYYY-MM-DD
    // --------------------------------------------------------

    let match =
        text.match(
            /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
        );


    if (match) {

        return new Date(
            Number(
                match[1]
            ),
            Number(
                match[2]
            ) - 1,
            Number(
                match[3]
            )
        );

    }


    // --------------------------------------------------------
    // DD-MM-YYYY
    // --------------------------------------------------------

    match =
        text.match(
            /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/
        );


    if (match) {

        return new Date(
            Number(
                match[3]
            ),
            Number(
                match[2]
            ) - 1,
            Number(
                match[1]
            )
        );

    }


    // --------------------------------------------------------
    // DD-MMM-YYYY
    // --------------------------------------------------------

    match =
        text.match(
            /^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})/
        );


    if (match) {

        const month =
            monthNumber(
                match[2]
            );


        if (
            month !== null
        ) {

            return new Date(
                Number(
                    match[3]
                ),
                month,
                Number(
                    match[1]
                )
            );

        }

    }


    // --------------------------------------------------------
    // DD-MMM
    //
    // Example:
    // 28-Aug
    // --------------------------------------------------------

    match =
        text.match(
            /^(\d{1,2})[-/ ]([A-Za-z]{3,9})/
        );


    if (match) {

        const month =
            monthNumber(
                match[2]
            );


        if (
            month !== null
        ) {

            return new Date(
                new Date().getFullYear(),
                month,
                Number(
                    match[1]
                )
            );

        }

    }


    // --------------------------------------------------------
    // DD/MM
    // --------------------------------------------------------

    match =
        text.match(
            /^(\d{1,2})[-/](\d{1,2})/
        );


    if (match) {

        return new Date(
            new Date().getFullYear(),
            Number(
                match[2]
            ) - 1,
            Number(
                match[1]
            )
        );

    }


    return null;

}


// ============================================================
// MONTH NUMBER
// ============================================================

function monthNumber(
    month
) {

    const months = {

        jan: 0,
        january: 0,

        feb: 1,
        february: 1,

        mar: 2,
        march: 2,

        apr: 3,
        april: 3,

        may: 4,

        jun: 5,
        june: 5,

        jul: 6,
        july: 6,

        aug: 7,
        august: 7,

        sep: 8,
        sept: 8,
        september: 8,

        oct: 9,
        october: 9,

        nov: 10,
        november: 10,

        dec: 11,
        december: 11

    };


    const key =
        String(
            month
        )
            .toLowerCase();


    return Object.prototype.hasOwnProperty.call(
        months,
        key
    )
        ? months[key]
        : null;

}


// ============================================================
// FORMAT DATE
// ============================================================

function formatDate(
    date
) {

    if (
        !date
    ) {

        return "";

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short"
        }
    );

}


// ============================================================
// FORMAT FULL DATE
// ============================================================

function formatFullDate(
    date
) {

    if (
        !date
    ) {

        return "";

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


// ============================================================
// CLEAN CURRENT DATA
// ============================================================

function cleanCurrentData(
    data
) {

    return data
        .filter(
            row =>
                row["IPO Name"] &&
                row["IPO Name"].trim() !== ""
        )
        .map(
            row => {

                return {

                    ...row,

                    "IPO Name":
                        cleanIPOName(
                            row["IPO Name"]
                        )

                };

            }
        );

}


// ============================================================
// CLEAN HISTORY DATA
// ============================================================

function cleanHistoryData(
    data
) {

    return data
        .filter(
            row =>
                row["IPO Name"] &&
                row["Date"]
        )
        .map(
            row => {

                return {

                    ...row,

                    "IPO Name":
                        cleanIPOName(
                            row["IPO Name"]
                        ),

                    GMP:
                        toNumber(
                            row["GMP"]
                        ),

                    "GMP %":
                        toNumber(
                            row["GMP %"]
                        )

                };

            }
        );

}


// ============================================================
// CLEAN IPO NAME
// ============================================================

function cleanIPOName(
    name
) {

    if (
        !name
    ) {

        return "";

    }


    let value =
        String(
            name
        )
            .replace(
                /\s+/g,
                " "
            )
            .trim();


    // Remove unwanted scraper status suffixes
    value =
        value.replace(
            /(CALLOTTED|CLOSED|OPEN|IPO)$/i,
            ""
        )
            .trim();


    return value;

}


// ============================================================
// LISTING DATE SORT
// LATEST DATE FIRST
// ============================================================

function compareListingDateDescending(
    a,
    b
) {

    const dateA =
        parseDate(
            a["Listing Date"]
        );

    const dateB =
        parseDate(
            b["Listing Date"]
        );


    if (
        !dateA &&
        !dateB
    ) {

        return 0;

    }


    if (
        !dateA
    ) {

        return 1;

    }


    if (
        !dateB
    ) {

        return -1;

    }


    return dateB - dateA;

}


// ============================================================
// POPULATE IPO DROPDOWN
// LATEST LISTING DATE FIRST
// ============================================================

function populateIPODropdown() {

    if (
        !ipoSelect
    ) {

        return;

    }


    ipoSelect.innerHTML = "";


    // --------------------------------------------------------
    // Default option
    // --------------------------------------------------------

    const defaultOption =
        document.createElement(
            "option"
        );


    defaultOption.value =
        "";


    defaultOption.textContent =
        "Select IPO for GMP Trend";


    ipoSelect.appendChild(
        defaultOption
    );


    // --------------------------------------------------------
    // Copy and sort
    // --------------------------------------------------------

    const sorted =
        [
            ...currentData
        ]
            .sort(
                compareListingDateDescending
            );


    // --------------------------------------------------------
    // Add IPOs
    // --------------------------------------------------------

    sorted.forEach(
        ipo => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                ipo["IPO Name"];


            const listingDate =
                ipo["Listing Date"];


            option.textContent =
                listingDate
                    ? `${ipo["IPO Name"]} — Listing: ${listingDate}`
                    : ipo["IPO Name"];


            ipoSelect.appendChild(
                option
            );

        }
    );

}


// ============================================================
// TABLE RENDER
// ============================================================

function renderTable(
    data
) {

    if (
        !tableBody
    ) {

        return;

    }


    tableBody.innerHTML = "";


    data.forEach(
        ipo => {

            const tr =
                document.createElement(
                    "tr"
                );


            const fields = [

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

                "Estimated Listing Price"

            ];


            fields.forEach(
                field => {

                    const td =
                        document.createElement(
                            "td"
                        );


                    let value =
                        ipo[field] ?? "";


                    // ------------------------------------------------
                    // GMP %
                    // ------------------------------------------------

                    if (
                        field === "GMP %"
                    ) {

                        value =
                            `${toNumber(
                                value
                            ).toFixed(2)}%`;

                    }


                    // ------------------------------------------------
                    // GMP
                    // ------------------------------------------------

                    else if (
                        field === "GMP"
                    ) {

                        value =
                            `₹${toNumber(
                                value
                            ).toFixed(0)}`;

                    }


                    // ------------------------------------------------
                    // IPO Price
                    // ------------------------------------------------

                    else if (
                        field === "IPO Price"
                    ) {

                        value =
                            `₹${toNumber(
                                value
                            ).toFixed(2)}`;

                    }


                    // ------------------------------------------------
                    // Estimated Listing
                    // ------------------------------------------------

                    else if (
                        field ===
                        "Estimated Listing Price"
                    ) {

                        value =
                            `₹${toNumber(
                                value
                            ).toFixed(2)}`;

                    }


                    td.textContent =
                        value;


                    tr.appendChild(
                        td
                    );

                }
            );


            tableBody.appendChild(
                tr
            );

        }
    );

}


// ============================================================
// SEARCH
// ============================================================

if (
    searchBox
) {

    searchBox.addEventListener(
        "input",
        function () {

            const search =
                this.value
                    .toLowerCase()
                    .trim();


            const filtered =
                currentData.filter(
                    ipo => {

                        const name =
                            String(
                                ipo["IPO Name"] ||
                                ""
                            )
                                .toLowerCase();


                        return name.includes(
                            search
                        );

                    }
                );


            renderTable(
                filtered
            );

        }
    );

}


// ============================================================
// IPO DROPDOWN CHANGE
// ============================================================

if (
    ipoSelect
) {

    ipoSelect.addEventListener(
        "change",
        function () {

            const selected =
                this.value;


            if (
                !selected
            ) {

                destroyChart();

                if (
                    chartTitle
                ) {

                    chartTitle.textContent =
                        "GMP % Trend";

                }

                localStorage.removeItem(
                    "selectedIPO"
                );

                return;

            }


            localStorage.setItem(
                "selectedIPO",
                selected
            );


            drawGMPChart(
                selected
            );

        }
    );

}


// ============================================================
// GET HISTORY FOR IPO
// ============================================================

function getIPOHistory(
    ipoName
) {

    let data =
        historyData.filter(
            row => {

                return (
                    normalizeIPOName(
                        row["IPO Name"]
                    ) ===
                    normalizeIPOName(
                        ipoName
                    )
                );

            }
        );


    // --------------------------------------------------------
    // Sort OLDEST → NEWEST
    // Required for continuous line chart
    // --------------------------------------------------------

    data.sort(
        function (a, b) {

            const dateA =
                parseDate(
                    a["Date"]
                );

            const dateB =
                parseDate(
                    b["Date"]
                );


            if (
                !dateA &&
                !dateB
            ) {

                return 0;

            }


            if (
                !dateA
            ) {

                return 1;

            }


            if (
                !dateB
            ) {

                return -1;

            }


            return dateA - dateB;

        }
    );


    // --------------------------------------------------------
    // Keep one observation per date
    // --------------------------------------------------------

    const map =
        new Map();


    data.forEach(
        row => {

            const date =
                parseDate(
                    row["Date"]
                );


            if (
                !date
            ) {

                return;

            }


            const key =
                date.toISOString()
                    .split("T")[0];


            // Latest record for same date
            map.set(
                key,
                row
            );

        }
    );


    return Array.from(
        map.values()
    )
        .sort(
            function (a, b) {

                return (
                    parseDate(
                        a["Date"]
                    ) -
                    parseDate(
                        b["Date"]
                    )
                );

            }
        );

}


// ============================================================
// NORMALIZE IPO NAME
// ============================================================

function normalizeIPOName(
    name
) {

    return cleanIPOName(
        name
    )
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


// ============================================================
// DRAW GMP CHART
// ============================================================

function drawGMPChart(
    ipoName
) {

    if (
        !chartCanvas
    ) {

        console.error(
            "Canvas #gmpChart not found."
        );

        return;

    }


    // --------------------------------------------------------
    // Get history
    // --------------------------------------------------------

    let data =
        getIPOHistory(
            ipoName
        );


    // --------------------------------------------------------
    // Current IPO
    // --------------------------------------------------------

    const currentIPO =
        currentData.find(
            ipo =>
                normalizeIPOName(
                    ipo["IPO Name"]
                ) ===
                normalizeIPOName(
                    ipoName
                )
        );


    // --------------------------------------------------------
    // If history is unavailable
    // --------------------------------------------------------

    if (
        data.length === 0
    ) {

        // Use today's current value
        // as a fallback.

        if (
            currentIPO
        ) {

            data = [

                {

                    "IPO Name":
                        ipoName,

                    "Date":
                        new Date()
                            .toISOString()
                            .split("T")[0],

                    "GMP":
                        currentIPO["GMP"],

                    "GMP %":
                        currentIPO["GMP %"]

                }

            ];

        } else {

            destroyChart();

            setStatus(
                "No GMP history available."
            );

            return;

        }

    }


    // --------------------------------------------------------
    // CHART TITLE
    // --------------------------------------------------------

    if (
        chartTitle
    ) {

        chartTitle.textContent =
            `${ipoName} — GMP % Trend`;

    }


    // --------------------------------------------------------
    // Labels
    // --------------------------------------------------------

    const labels =
        data.map(
            row => {

                return formatDate(
                    parseDate(
                        row["Date"]
                    )
                );

            }
        );


    // --------------------------------------------------------
    // GMP %
    // --------------------------------------------------------

    const values =
        data.map(
            row => {

                return toNumber(
                    row["GMP %"]
                );

            }
        );


    // --------------------------------------------------------
    // Dates
    // --------------------------------------------------------

    const dates =
        data.map(
            row =>
                parseDate(
                    row["Date"]
                )
        );


    // --------------------------------------------------------
    // Destroy previous chart
    // --------------------------------------------------------

    destroyChart();


    // --------------------------------------------------------
    // Create chart
    // --------------------------------------------------------

    gmpChart =
        new Chart(
            chartCanvas,
            {

                type: "line",

                data: {

                    labels: labels,

                    datasets: [

                        {

                            label:
                                "GMP %",

                            data:
                                values,

                            borderWidth:
                                2,

                            pointRadius:
                                4,

                            pointHoverRadius:
                                7,

                            tension:
                                0.2,

                            fill:
                                false,

                            spanGaps:
                                true

                        }

                    ]

                },


                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,


                    interaction: {

                        mode:
                            "index",

                        intersect:
                            false

                    },


                    plugins: {

                        legend: {

                            display:
                                true

                        },


                        tooltip: {

                            callbacks: {

                                title:
                                    function (
                                        tooltipItems
                                    ) {

                                        const index =
                                            tooltipItems[0]
                                                .dataIndex;


                                        return formatFullDate(
                                            dates[index]
                                        );

                                    },


                                label:
                                    function (
                                        context
                                    ) {

                                        return (
                                            " GMP: " +
                                            Number(
                                                context.parsed.y
                                            ).toFixed(2) +
                                            "%"
                                        );

                                    }

                            }

                        }

                    },


                    scales: {

                        x: {

                            title: {

                                display:
                                    true,

                                text:
                                    "Date"

                            },


                            ticks: {

                                autoSkip:
                                    true,

                                maxTicksLimit:
                                    15,

                                maxRotation:
                                    45,

                                minRotation:
                                    0

                            }

                        },


                        y: {

                            beginAtZero:
                                true,


                            title: {

                                display:
                                    true,

                                text:
                                    "GMP %"

                            },


                            ticks: {

                                callback:
                                    function (
                                        value
                                    ) {

                                        return (
                                            value +
                                            "%"
                                        );

                                    }

                            }

                        }

                    }

                }

            }
        );


    // --------------------------------------------------------
    // Status
    // --------------------------------------------------------

    setStatus(
        `${data.length} GMP observations for ${ipoName}`
    );

}


// ============================================================
// DESTROY CHART
// ============================================================

function destroyChart() {

    if (
        gmpChart
    ) {

        gmpChart.destroy();

        gmpChart = null;

    }

}


// ============================================================
// STATUS
// ============================================================

function setStatus(
    message
) {

    if (
        statusBox
    ) {

        statusBox.textContent =
            message;

    }

    console.log(
        message
    );

}


// ============================================================
// AUTO REFRESH
// ============================================================

setInterval(
    function () {

        console.log(
            "Refreshing IPO GMP data..."
        );

        loadDashboard();

    },
    AUTO_REFRESH_MINUTES *
    60 *
    1000
);


// ============================================================
// END
// ============================================================
```
