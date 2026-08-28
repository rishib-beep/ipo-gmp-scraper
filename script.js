```javascript
"use strict";


// ============================================================
// CONFIG
// ============================================================

const CURRENT_CSV =
    "./ipo_gmp_result.csv";

const HISTORY_CSV =
    "./ipo_gmp_history.csv";


let currentData = [];

let historyData = [];

let gmpChart = null;


// ============================================================
// DOM
// ============================================================

const ipoSelect =
    document.getElementById(
        "ipoSelect"
    );

const searchBox =
    document.getElementById(
        "searchBox"
    );

const tableBody =
    document.getElementById(
        "ipoTableBody"
    );

const statusBox =
    document.getElementById(
        "status"
    );

const chartTitle =
    document.getElementById(
        "chartTitle"
    );

const chartCanvas =
    document.getElementById(
        "gmpChart"
    );


// ============================================================
// START
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    loadDashboard
);


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    try {

        setStatus(
            "⏳ Loading IPO GMP data..."
        );


        // ----------------------------------------------------
        // CURRENT DATA
        // ----------------------------------------------------

        currentData =
            await loadCSV(
                CURRENT_CSV
            );


        console.log(
            "Current IPO rows:",
            currentData.length
        );


        // ----------------------------------------------------
        // HISTORY DATA
        // ----------------------------------------------------

        try {

            historyData =
                await loadCSV(
                    HISTORY_CSV
                );

        }

        catch (error) {

            console.warn(
                "History CSV unavailable:",
                error
            );

            historyData = [];

        }


        console.log(
            "History rows:",
            historyData.length
        );


        // ----------------------------------------------------
        // CLEAN DATA
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
        // SORT CURRENT IPOs
        // LATEST LISTING FIRST
        // ----------------------------------------------------

        currentData.sort(
            sortByListingDate
        );


        // ----------------------------------------------------
        // RENDER TABLE
        // ----------------------------------------------------

        renderTable(
            currentData
        );


        // ----------------------------------------------------
        // POPULATE DROPDOWN
        // ----------------------------------------------------

        populateDropdown();


        // ----------------------------------------------------
        // STATUS
        // ----------------------------------------------------

        setStatus(
            `✅ ${currentData.length} IPOs loaded | ${historyData.length} historical records`
        );


        // ----------------------------------------------------
        // RESTORE PREVIOUS IPO SELECTION
        // ----------------------------------------------------

        const saved =
            localStorage.getItem(
                "selectedIPO"
            );


        if (
            saved &&
            currentData.some(
                ipo =>
                    normalize(
                        ipo["IPO Name"]
                    ) ===
                    normalize(
                        saved
                    )
            )
        ) {

            ipoSelect.value =
                saved;


            drawChart(
                saved
            );

        }

    }

    catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );


        setStatus(
            "❌ Unable to load IPO data. Check browser Console."
        );


        if (ipoSelect) {

            ipoSelect.innerHTML =
                '<option value="">Unable to load IPO data</option>';

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


    if (
        !response.ok
    ) {

        throw new Error(
            `${filename}: HTTP ${response.status}`
        );

    }


    const text =
        await response.text();


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

    text =
        text.replace(
            /^\uFEFF/,
            ""
        );


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
        // QUOTES
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

            }

            else {

                insideQuotes =
                    !insideQuotes;

            }

        }


        // ----------------------------------------------------
        // COMMA
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
        // NEW LINE
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


            if (
                row.some(
                    x =>
                        String(x).trim() !== ""
                )
            ) {

                rows.push(
                    row
                );

            }


            row = [];

            cell = "";

        }


        // ----------------------------------------------------
        // NORMAL CHARACTER
        // ----------------------------------------------------

        else {

            cell += char;

        }

    }


    // --------------------------------------------------------
    // LAST ROW
    // --------------------------------------------------------

    if (
        cell !== "" ||
        row.length > 0
    ) {

        row.push(
            cell
        );


        if (
            row.some(
                x =>
                    String(x).trim() !== ""
            )
        ) {

            rows.push(
                row
            );

        }

    }


    // --------------------------------------------------------
    // NO DATA
    // --------------------------------------------------------

    if (
        rows.length < 2
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
        "CSV headers:",
        headers
    );


    // --------------------------------------------------------
    // OBJECTS
    // --------------------------------------------------------

    return rows
        .slice(1)
        .map(
            values => {

                const obj = {};


                headers.forEach(
                    (
                        header,
                        index
                    ) => {

                        obj[header] =
                            cleanText(
                                values[index] || ""
                            );

                    }
                );


                return obj;

            }
        );

}


// ============================================================
// TEXT CLEANING
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


    const n =
        parseFloat(
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
                .trim()
        );


    return Number.isFinite(
        n
    )
        ? n
        : 0;

}


// ============================================================
// IPO NAME NORMALIZATION
// ============================================================

function normalize(
    value
) {

    return String(
        value || ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .replace(
            /(CALLOTTED|CLOSED|OPEN)$/i,
            ""
        )
        .trim()
        .toLowerCase();

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


    // --------------------------------------------------------
    // Remove GMP text if present
    // --------------------------------------------------------

    text =
        text
            .replace(
                /\s*GMP\s*:.*$/i,
                ""
            )
            .trim();


    // --------------------------------------------------------
    // YYYY-MM-DD
    // YYYY/MM/DD
    // --------------------------------------------------------

    let m =
        text.match(
            /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
        );


    if (m) {

        return createSafeDate(
            Number(m[1]),
            Number(m[2]),
            Number(m[3])
        );

    }


    // --------------------------------------------------------
    // DD-MM-YYYY
    // DD/MM/YYYY
    // --------------------------------------------------------

    m =
        text.match(
            /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/
        );


    if (m) {

        return createSafeDate(
            Number(m[3]),
            Number(m[2]),
            Number(m[1])
        );

    }


    // --------------------------------------------------------
    // DD-MMM-YYYY
    // DD MMM YYYY
    // --------------------------------------------------------

    m =
        text.match(
            /^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})/
        );


    if (m) {

        const month =
            monthNumber(
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


    // --------------------------------------------------------
    // DD-MMM
    // DD MMM
    // --------------------------------------------------------

    m =
        text.match(
            /^(\d{1,2})[- ]([A-Za-z]{3,9})/
        );


    if (m) {

        const month =
            monthNumber(
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


    // --------------------------------------------------------
    // Native Date fallback
    // --------------------------------------------------------

    const nativeDate =
        new Date(
            text
        );


    if (
        !Number.isNaN(
            nativeDate.getTime()
        )
    ) {

        return new Date(
            nativeDate.getFullYear(),
            nativeDate.getMonth(),
            nativeDate.getDate()
        );

    }


    return null;

}


// ============================================================
// SAFE DATE
// ============================================================

function createSafeDate(
    year,
    month,
    day
) {

    const date =
        new Date(
            year,
            month - 1,
            day
        );


    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {

        return null;

    }


    return date;

}


// ============================================================
// MONTH
// ============================================================

function monthNumber(
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
// SORT LISTING DATE
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
// CLEAN CURRENT DATA
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
                    row["IPO Name"]
                        .replace(
                            /(CALLOTTED|CLOSED|OPEN)$/i,
                            ""
                        )
                        .trim();


                return row;

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

                row["GMP"] =
                    toNumber(
                        row["GMP"]
                    );


                row["GMP %"] =
                    toNumber(
                        row["GMP %"]
                    );


                return row;

            }
        );

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


    ipoSelect.innerHTML =
        "";


    const first =
        document.createElement(
            "option"
        );


    first.value =
        "";


    first.textContent =
        "Select IPO for GMP Trend";


    ipoSelect.appendChild(
        first
    );


    currentData
        .slice()
        .sort(
            sortByListingDate
        )
        .forEach(
            ipo => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    ipo["IPO Name"];


                option.textContent =
                    `${ipo["IPO Name"]} — Listing: ${ipo["Listing Date"] || "N/A"}`;


                ipoSelect.appendChild(
                    option
                );

            }
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


    tableBody.innerHTML =
        "";


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


    data.forEach(
        ipo => {

            const tr =
                document.createElement(
                    "tr"
                );


            fields.forEach(
                field => {

                    const td =
                        document.createElement(
                            "td"
                        );


                    let value =
                        ipo[field] || "";


                    // GMP
                    if (
                        field === "GMP"
                    ) {

                        value =
                            "₹" +
                            toNumber(
                                value
                            ).toFixed(
                                0
                            );

                    }


                    // GMP %
                    if (
                        field === "GMP %"
                    ) {

                        value =
                            toNumber(
                                value
                            ).toFixed(
                                2
                            ) +
                            "%";

                    }


                    // IPO PRICE
                    if (
                        field === "IPO Price"
                    ) {

                        value =
                            "₹" +
                            toNumber(
                                value
                            ).toFixed(
                                2
                            );

                    }


                    // ESTIMATED LISTING PRICE
                    if (
                        field ===
                        "Estimated Listing Price"
                    ) {

                        value =
                            "₹" +
                            toNumber(
                                value
                            ).toFixed(
                                2
                            );

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


            filtered.sort(
                sortByListingDate
            );


            renderTable(
                filtered
            );

        }
    );

}


// ============================================================
// IPO SELECTION
// ============================================================

if (
    ipoSelect
) {

    ipoSelect.addEventListener(
        "change",
        function () {

            const ipoName =
                this.value;


            if (
                !ipoName
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
                ipoName
            );


            drawChart(
                ipoName
            );

        }
    );

}


// ============================================================
// GET IPO HISTORY
// ============================================================

function getIPOHistory(
    ipoName
) {

    const target =
        normalize(
            ipoName
        );


    return historyData
        .filter(
            row =>
                normalize(
                    row["IPO Name"]
                ) === target
        );

}


// ============================================================
// DRAW CHART
// ============================================================
// IMPORTANT:
// Historical GMP values are sorted OLDEST → NEWEST.
// Therefore:
//
// 20 Aug → 21 Aug → 22 Aug → 23 Aug → ...
//
// are connected by ONE continuous line.
// ============================================================

function drawChart(
    ipoName
) {

    console.log(
        "========================================"
    );

    console.log(
        "Drawing chart for:",
        ipoName
    );


    // --------------------------------------------------------
    // GET HISTORY
    // --------------------------------------------------------

    let rows =
        getIPOHistory(
            ipoName
        );


    console.log(
        "Matching history rows:",
        rows.length
    );


    // --------------------------------------------------------
    // CONVERT TO DATE + GMP %
    // --------------------------------------------------------

    rows =
        rows
            .map(
                row => {

                    const date =
                        parseDate(
                            row["Date"]
                        );


                    const gmp =
                        toNumber(
                            row["GMP %"]
                        );


                    return {

                        originalDate:
                            row["Date"],

                        date:
                            date,

                        gmp:
                            gmp

                    };

                }
            )
            .filter(
                row =>
                    row.date !== null
            );


    // --------------------------------------------------------
    // SORT OLDEST → NEWEST
    // --------------------------------------------------------

    rows.sort(
        (a, b) =>
            a.date - b.date
    );


    // --------------------------------------------------------
    // REMOVE DUPLICATE DATES
    // --------------------------------------------------------
    //
    // If scraper has multiple records on:
    //
    // 20 Aug
    // 20 Aug
    // 20 Aug
    //
    // the LAST record for 20 Aug is used.
    //
    // Then:
    //
    // 20 Aug
    // 21 Aug
    // 22 Aug
    // 23 Aug
    //
    // are connected.
    // --------------------------------------------------------

    const dateMap =
        new Map();


    rows.forEach(
        row => {

            const key =
                getDateKey(
                    row.date
                );


            dateMap.set(
                key,
                row
            );

        }
    );


    // --------------------------------------------------------
    // FINAL CHART POINTS
    // --------------------------------------------------------

    const points =
        Array.from(
            dateMap.values()
        )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    // --------------------------------------------------------
    // DEBUG
    // --------------------------------------------------------

    console.log(
        "Final chart points:"
    );


    points.forEach(
        point => {

            console.log(
                formatDebugDate(
                    point.date
                ),
                "=>",
                point.gmp + "%"
            );

        }
    );


    // --------------------------------------------------------
    // FALLBACK
    // --------------------------------------------------------

    if (
        points.length === 0
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

            points.push({

                date:
                    new Date(),

                gmp:
                    toNumber(
                        current["GMP %"]
                    )

            });

        }

    }


    // --------------------------------------------------------
    // NO DATA
    // --------------------------------------------------------

    if (
        points.length === 0
    ) {

        destroyChart();


        if (
            chartTitle
        ) {

            chartTitle.textContent =
                `${ipoName} — GMP % Trend`;

        }


        setStatus(
            `⚠️ No GMP history available for ${ipoName}`
        );


        return;

    }


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


    // --------------------------------------------------------
    // VALUES
    // --------------------------------------------------------

    const values =
        points.map(
            point =>
                point.gmp
        );


    // --------------------------------------------------------
    // DESTROY OLD CHART
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
    // CREATE CHART
    // --------------------------------------------------------

    gmpChart =
        new Chart(
            chartCanvas,
            {

                type:
                    "line",


                data: {

                    labels:
                        labels,


                    datasets: [

                        {

                            label:
                                "GMP %",


                            data:
                                values,


                            // ------------------------------------------------
                            // LINE SETTINGS
                            // ------------------------------------------------

                            borderWidth:
                                3,


                            tension:
                                0,


                            fill:
                                false,


                            // Do NOT skip gaps
                            spanGaps:
                                false,


                            // ------------------------------------------------
                            // POINT SETTINGS
                            // ------------------------------------------------

                            pointRadius:
                                4,


                            pointHoverRadius:
                                7

                        }

                    ]

                },


                options: {

                    responsive:
                        true,


                    maintainAspectRatio:
                        false,


                    // ------------------------------------------------
                    // INTERACTION
                    // ------------------------------------------------

                    interaction: {

                        intersect:
                            false,

                        mode:
                            "index"

                    },


                    // ------------------------------------------------
                    // PLUGINS
                    // ------------------------------------------------

                    plugins: {

                        legend: {

                            display:
                                true

                        },


                        tooltip: {

                            callbacks: {

                                // --------------------------------------------
                                // TOOLTIP DATE
                                // --------------------------------------------

                                title:
                                    function(
                                        context
                                    ) {

                                        const index =
                                            context[0]
                                                .dataIndex;


                                        const point =
                                            points[
                                                index
                                            ];


                                        if (
                                            !point
                                        ) {

                                            return "";

                                        }


                                        return point
                                            .date
                                            .toLocaleDateString(
                                                "en-IN",
                                                {
                                                    day:
                                                        "2-digit",

                                                    month:
                                                        "short",

                                                    year:
                                                        "numeric"
                                                }
                                            );

                                    },


                                // --------------------------------------------
                                // TOOLTIP GMP
                                // --------------------------------------------

                                label:
                                    function(
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


                    // ------------------------------------------------
                    // AXIS
                    // ------------------------------------------------

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

                            // IMPORTANT:
                            // Do not force the chart to start at zero.
                            // This makes small GMP changes much easier to see.

                            title: {

                                display:
                                    true,

                                text:
                                    "GMP %"

                            },


                            ticks: {

                                callback:
                                    function(
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
    // STATUS
    // --------------------------------------------------------

    setStatus(
        `📈 ${ipoName}: ${points.length} daily GMP values plotted`
    );

}


// ============================================================
// GET DATE KEY
// ============================================================

function getDateKey(
    date
) {

    return (
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
        )
    );

}


// ============================================================
// DEBUG DATE
// ============================================================

function formatDebugDate(
    date
) {

    return date.toLocaleDateString(
        "en-IN",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric"
        }
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

        gmpChart =
            null;

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
//
// Reload current and historical CSV every 5 minutes.
// ============================================================

setInterval(
    function () {

        loadDashboard();

    },
    5 * 60 * 1000
);
```
