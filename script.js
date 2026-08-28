```javascript
// ============================================================
// IPO GMP DASHBOARD
// COMPLETE FIXED SCRIPT
// ============================================================

"use strict";


// ============================================================
// CONFIG
// ============================================================

const CURRENT_CSV = "./ipo_gmp_result.csv";
const HISTORY_CSV = "./ipo_gmp_history.csv";

let currentData = [];
let historyData = [];
let gmpChart = null;


// ============================================================
// DOM
// ============================================================

const ipoSelect = document.getElementById("ipoSelect");
const searchBox = document.getElementById("searchBox");
const tableBody = document.getElementById("ipoTableBody");
const statusBox = document.getElementById("status");
const chartTitle = document.getElementById("chartTitle");
const chartCanvas = document.getElementById("gmpChart");


// ============================================================
// START
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("================================");
    console.log("IPO GMP DASHBOARD STARTING");
    console.log("================================");

    loadDashboard();

});


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    try {

        setStatus("⏳ Loading IPO data...");

        console.log("Current CSV:", CURRENT_CSV);
        console.log("History CSV:", HISTORY_CSV);


        // ----------------------------------------------------
        // CURRENT DATA
        // ----------------------------------------------------

        currentData = await loadCSV(
            CURRENT_CSV
        );

        console.log(
            "Current rows:",
            currentData.length
        );


        // ----------------------------------------------------
        // HISTORY DATA
        // ----------------------------------------------------

        try {

            historyData = await loadCSV(
                HISTORY_CSV
            );

            console.log(
                "History rows:",
                historyData.length
            );

        } catch (error) {

            console.warn(
                "History CSV unavailable:",
                error
            );

            historyData = [];

        }


        // ----------------------------------------------------
        // CLEAN
        // ----------------------------------------------------

        currentData =
            cleanCurrentData(
                currentData
            );

        historyData =
            cleanHistoryData(
                historyData
            );


        // ----------------------------------------------------
        // SORT BY LISTING DATE
        // LATEST FIRST
        // ----------------------------------------------------

        currentData.sort(
            sortByListingDate
        );


        // ----------------------------------------------------
        // TABLE
        // ----------------------------------------------------

        renderTable(
            currentData
        );


        // ----------------------------------------------------
        // DROPDOWN
        // ----------------------------------------------------

        populateDropdown();


        // ----------------------------------------------------
        // STATUS
        // ----------------------------------------------------

        setStatus(
            `✅ ${currentData.length} IPOs loaded | ${historyData.length} historical records`
        );


        // ----------------------------------------------------
        // RESTORE IPO
        // ----------------------------------------------------

        const savedIPO =
            localStorage.getItem(
                "selectedIPO"
            );


        if (
            savedIPO &&
            currentData.some(
                ipo =>
                    normalize(
                        ipo["IPO Name"]
                    ) ===
                    normalize(
                        savedIPO
                    )
            )
        ) {

            ipoSelect.value =
                savedIPO;

            drawChart(
                savedIPO
            );

        }


    } catch (error) {

        console.error(
            "DASHBOARD ERROR:",
            error
        );


        setStatus(
            "❌ Error loading IPO data. Open browser Console (F12) for details."
        );


        if (ipoSelect) {

            ipoSelect.innerHTML = "";

            const option =
                document.createElement(
                    "option"
                );

            option.textContent =
                "Error loading IPO data";

            option.value = "";

            ipoSelect.appendChild(
                option
            );

        }

    }

}


// ============================================================
// LOAD CSV
// ============================================================

async function loadCSV(
    filename
) {

    const url =
        filename +
        "?v=" +
        Date.now();


    console.log(
        "Fetching:",
        url
    );


    const response =
        await fetch(
            url,
            {
                cache: "no-store"
            }
        );


    console.log(
        "HTTP:",
        response.status,
        response.statusText
    );


    if (!response.ok) {

        throw new Error(
            `Unable to load ${filename}: HTTP ${response.status}`
        );

    }


    const text =
        await response.text();


    console.log(
        `${filename} size:`,
        text.length,
        "characters"
    );


    if (
        !text.trim()
    ) {

        throw new Error(
            `${filename} is empty`
        );

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

    let quoted = false;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const char =
            text[i];


        if (
            char === '"'
        ) {

            if (
                quoted &&
                text[i + 1] === '"'
            ) {

                cell += '"';

                i++;

            } else {

                quoted =
                    !quoted;

            }

        }

        else if (
            char === "," &&
            !quoted
        ) {

            row.push(
                cell
            );

            cell = "";

        }

        else if (
            (
                char === "\n" ||
                char === "\r"
            ) &&
            !quoted
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

            if (
                row.length > 0
            ) {

                rows.push(
                    row
                );

            }


            row = [];

            cell = "";

        }

        else {

            cell += char;

        }

    }


    // Last cell

    if (
        cell !== "" ||
        row.length > 0
    ) {

        row.push(
            cell
        );

        rows.push(
            row
        );

    }


    if (
        rows.length === 0
    ) {

        return [];

    }


    // --------------------------------------------------------
    // HEADERS
    // --------------------------------------------------------

    const headers =
        rows[0].map(
            h =>
                cleanText(
                    h
                )
        );


    console.log(
        "CSV HEADERS:",
        headers
    );


    // --------------------------------------------------------
    // DATA
    // --------------------------------------------------------

    const data = [];


    for (
        let i = 1;
        i < rows.length;
        i++
    ) {

        const values =
            rows[i];


        if (
            values.length === 0
        ) {

            continue;

        }


        const obj = {};


        headers.forEach(
            (
                header,
                index
            ) => {

                obj[header] =
                    cleanText(
                        values[index] ||
                        ""
                    );

            }
        );


        data.push(
            obj
        );

    }


    return data;

}


// ============================================================
// CLEAN TEXT
// ============================================================

function cleanText(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /^\uFEFF/,
            ""
        )
        .replace(
            /\u00A0/g,
            " "
        )
        .trim();

}


// ============================================================
// NUMBER
// ============================================================

function number(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return 0;

    }


    const cleaned =
        String(
            value
        )
            .replace(
                /₹/g,
                ""
            )
            .replace(
                /,/g,
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
            .trim();


    const n =
        parseFloat(
            cleaned
        );


    return isNaN(n)
        ? 0
        : n;

}


// ============================================================
// IPO NAME
// ============================================================

function cleanIPOName(
    name
) {

    return String(
        name || ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .replace(
            /(CALLOTTED|CLOSED|OPEN)$/i,
            ""
        )
        .trim();

}


function normalize(
    value
) {

    return cleanIPOName(
        value
    )
        .toLowerCase()
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


// ============================================================
// DATE PARSER
// ============================================================

function parseDate(
    value
) {

    if (
        !value
    ) {

        return null;

    }


    let text =
        String(
            value
        )
            .trim();


    // Remove GMP text

    text =
        text.replace(
            /\s*GMP\s*:.*$/i,
            ""
        )
            .trim();


    // YYYY-MM-DD

    let m =
        text.match(
            /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
        );


    if (m) {

        return new Date(
            Number(m[1]),
            Number(m[2]) - 1,
            Number(m[3])
        );

    }


    // DD-MM-YYYY

    m =
        text.match(
            /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/
        );


    if (m) {

        return new Date(
            Number(m[3]),
            Number(m[2]) - 1,
            Number(m[1])
        );

    }


    // DD-MMM-YYYY

    m =
        text.match(
            /^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})/
        );


    if (m) {

        const month =
            getMonth(
                m[2]
            );


        if (
            month !== null
        ) {

            return new Date(
                Number(m[3]),
                month,
                Number(m[1])
            );

        }

    }


    // DD-MMM

    m =
        text.match(
            /^(\d{1,2})[- ]([A-Za-z]{3,9})/
        );


    if (m) {

        const month =
            getMonth(
                m[2]
            );


        if (
            month !== null
        ) {

            return new Date(
                new Date().getFullYear(),
                month,
                Number(m[1])
            );

        }

    }


    return null;

}


// ============================================================
// MONTH
// ============================================================

function getMonth(
    value
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
            value
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
// CURRENT DATA CLEANING
// ============================================================

function cleanCurrentData(
    data
) {

    return data
        .filter(
            row =>
                row["IPO Name"]
        )
        .map(
            row => {

                row["IPO Name"] =
                    cleanIPOName(
                        row["IPO Name"]
                    );

                return row;

            }
        );

}


// ============================================================
// HISTORY CLEANING
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

                row["IPO Name"] =
                    cleanIPOName(
                        row["IPO Name"]
                    );

                row["GMP"] =
                    number(
                        row["GMP"]
                    );

                row["GMP %"] =
                    number(
                        row["GMP %"]
                    );

                return row;

            }
        );

}


// ============================================================
// LISTING DATE SORT
// LATEST FIRST
// ============================================================

function sortByListingDate(
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
// DROPDOWN
// ============================================================

function populateDropdown() {

    if (
        !ipoSelect
    ) {

        return;

    }


    ipoSelect.innerHTML = "";


    const first =
        document.createElement(
            "option"
        );


    first.value = "";

    first.textContent =
        "Select IPO for GMP Trend";


    ipoSelect.appendChild(
        first
    );


    const sorted =
        [...currentData]
            .sort(
                sortByListingDate
            );


    sorted.forEach(
        ipo => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                ipo["IPO Name"];


            option.textContent =
                ipo["Listing Date"]
                    ? `${ipo["IPO Name"]} — Listing: ${ipo["Listing Date"]}`
                    : ipo["IPO Name"];


            ipoSelect.appendChild(
                option
            );

        }
    );


    console.log(
        "Dropdown IPO count:",
        sorted.length
    );

}


// ============================================================
// TABLE
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
                        ipo[field] || "";


                    if (
                        field === "GMP"
                    ) {

                        value =
                            `₹${number(value).toFixed(0)}`;

                    }


                    if (
                        field === "GMP %"
                    ) {

                        value =
                            `${number(value).toFixed(2)}%`;

                    }


                    if (
                        field === "IPO Price"
                    ) {

                        value =
                            `₹${number(value).toFixed(2)}`;

                    }


                    if (
                        field ===
                        "Estimated Listing Price"
                    ) {

                        value =
                            `₹${number(value).toFixed(2)}`;

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

            const query =
                this.value
                    .toLowerCase()
                    .trim();


            const filtered =
                currentData.filter(
                    ipo =>
                        String(
                            ipo["IPO Name"]
                        )
                            .toLowerCase()
                            .includes(
                                query
                            )
                );


            renderTable(
                filtered
            );

        }
    );

}


// ============================================================
// DROPDOWN CHANGE
// ============================================================

if (
    ipoSelect
) {

    ipoSelect.addEventListener(
        "change",
        function () {

            const ipo =
                this.value;


            if (
                !ipo
            ) {

                destroyChart();

                if (
                    chartTitle
                ) {

                    chartTitle.textContent =
                        "GMP % Trend";

                }

                return;

            }


            localStorage.setItem(
                "selectedIPO",
                ipo
            );


            drawChart(
                ipo
            );

        }
    );

}


// ============================================================
// GET IPO HISTORY
// ============================================================

function getHistory(
    ipoName
) {

    const wanted =
        normalize(
            ipoName
        );


    const rows =
        historyData.filter(
            row =>
                normalize(
                    row["IPO Name"]
                ) === wanted
        );


    rows.sort(
        (a, b) =>
            parseDate(
                a["Date"]
            ) -
            parseDate(
                b["Date"]
            )
    );


    return rows;

}


// ============================================================
// DRAW CHART
// ============================================================

function drawChart(
    ipoName
) {

    if (
        !chartCanvas
    ) {

        return;

    }


    let rows =
        getHistory(
            ipoName
        );


    console.log(
        "Chart IPO:",
        ipoName
    );

    console.log(
        "Chart history rows:",
        rows
    );


    // --------------------------------------------------------
    // FALLBACK TO CURRENT DATA
    // --------------------------------------------------------

    if (
        rows.length === 0
    ) {

        const current =
            currentData.find(
                ipo =>
                    normalize(
                        ipo["IPO Name"]
                    ) ===
                    normalize(
                        ipoName
                    )
            );


        if (
            current
        ) {

            rows = [

                {

                    "Date":
                        new Date(),

                    "GMP %":
                        current["GMP %"]

                }

            ];

        }

    }


    if (
        rows.length === 0
    ) {

        setStatus(
            `⚠️ No GMP history found for ${ipoName}`
        );

        return;

    }


    // --------------------------------------------------------
    // REMOVE DUPLICATE DATES
    // --------------------------------------------------------

    const dateMap =
        new Map();


    rows.forEach(
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
                date.getFullYear() +
                "-" +
                String(
                    date.getMonth() + 1
                ).padStart(
                    2,
                    "0"
                ) +
                "-" +
                String(
                    date.getDate()
                ).padStart(
                    2,
                    "0"
                );


            dateMap.set(
                key,
                {

                    date:
                        date,

                    gmp:
                        number(
                            row["GMP %"]
                        )

                }
            );

        }
    );


    const points =
        Array.from(
            dateMap.values()
        )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    // --------------------------------------------------------
    // LABELS
    // --------------------------------------------------------

    const labels =
        points.map(
            point =>
                point.date.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short"
                    }
                )
        );


    const values =
        points.map(
            point =>
                point.gmp
        );


    // --------------------------------------------------------
    // DESTROY OLD
    // --------------------------------------------------------

    destroyChart();


    // --------------------------------------------------------
    // TITLE
    // --------------------------------------------------------

    if (
        chartTitle
    ) {

        chartTitle.textContent =
            `${ipoName} — GMP % Trend`;

    }


    // --------------------------------------------------------
    // CHART
    // --------------------------------------------------------

    gmpChart =
        new Chart(
            chartCanvas,
            {

                type: "line",

                data: {

                    labels:
                        labels,

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
                                6,

                            tension:
                                0.25,

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


                    plugins: {

                        legend: {

                            display:
                                true

                        },


                        tooltip: {

                            callbacks: {

                                label:
                                    function (
                                        context
                                    ) {

                                        return (
                                            " GMP: " +
                                            Number(
                                                context.parsed.y
                                            ).toFixed(
                                                2
                                            ) +
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
                                    value =>
                                        value +
                                        "%"

                            }

                        }

                    }

                }

            }
        );


    setStatus(
        `📈 ${ipoName}: ${points.length} GMP observations`
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
    () => {

        console.log(
            "Refreshing dashboard..."
        );

        loadDashboard();

    },
    5 * 60 * 1000
);


// ============================================================
// END
// ============================================================
```
