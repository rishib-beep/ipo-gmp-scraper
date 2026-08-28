```javascript
"use strict";

/* ============================================================
   CONFIG
============================================================ */

const CURRENT_CSV = "./ipo_gmp_result.csv";
const HISTORY_CSV = "./ipo_gmp_history.csv";

let currentData = [];
let historyData = [];
let gmpChart = null;


/* ============================================================
   DOM
============================================================ */

let ipoSelect;
let searchBox;
let tableBody;
let statusBox;
let chartTitle;
let chartCanvas;


/* ============================================================
   START
============================================================ */

document.addEventListener("DOMContentLoaded", function () {

    console.log("======================================");
    console.log("IPO GMP DASHBOARD STARTED");
    console.log("======================================");

    ipoSelect = document.getElementById("ipoSelect");
    searchBox = document.getElementById("searchBox");
    tableBody = document.getElementById("ipoTableBody");
    statusBox = document.getElementById("status");
    chartTitle = document.getElementById("chartTitle");
    chartCanvas = document.getElementById("gmpChart");

    console.log("ipoSelect:", ipoSelect);
    console.log("searchBox:", searchBox);
    console.log("tableBody:", tableBody);
    console.log("status:", statusBox);
    console.log("chart:", chartCanvas);

    loadDashboard();

});


/* ============================================================
   LOAD DASHBOARD
============================================================ */

async function loadDashboard() {

    setStatus("⏳ Loading IPO data...");

    try {

        /* ----------------------------------------------------
           LOAD CURRENT CSV
        ---------------------------------------------------- */

        console.log(
            "Loading:",
            CURRENT_CSV
        );

        currentData =
            await loadCSV(
                CURRENT_CSV
            );

        console.log(
            "Current rows:",
            currentData.length
        );


        /* ----------------------------------------------------
           VALIDATE CURRENT DATA
        ---------------------------------------------------- */

        if (
            currentData.length === 0
        ) {

            throw new Error(
                "ipo_gmp_result.csv contains no data"
            );

        }


        /* ----------------------------------------------------
           CLEAN CURRENT DATA
        ---------------------------------------------------- */

        currentData =
            cleanCurrentData(
                currentData
            );


        console.log(
            "Clean current rows:",
            currentData.length
        );


        /* ----------------------------------------------------
           LOAD HISTORY
        ---------------------------------------------------- */

        try {

            console.log(
                "Loading:",
                HISTORY_CSV
            );

            historyData =
                await loadCSV(
                    HISTORY_CSV
                );

            console.log(
                "History rows:",
                historyData.length
            );

            historyData =
                cleanHistoryData(
                    historyData
                );

        }

        catch (historyError) {

            console.warn(
                "History CSV could not be loaded:",
                historyError
            );

            historyData = [];

        }


        /* ----------------------------------------------------
           SORT
        ---------------------------------------------------- */

        currentData.sort(
            sortByListingDate
        );


        /* ----------------------------------------------------
           RENDER
        ---------------------------------------------------- */

        renderTable(
            currentData
        );


        populateDropdown();


        /* ----------------------------------------------------
           STATUS
        ---------------------------------------------------- */

        setStatus(
            `✅ ${currentData.length} IPOs loaded | ${historyData.length} historical records`
        );


        /* ----------------------------------------------------
           RESTORE SELECTION
        ---------------------------------------------------- */

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
            "======================================"
        );

        console.error(
            "LOAD ERROR:",
            error
        );

        console.error(
            "======================================"
        );


        setStatus(
            "❌ CSV loading failed. Check browser Console (F12)."
        );


        if (
            ipoSelect
        ) {

            ipoSelect.innerHTML =
                `
                <option value="">
                    CSV loading failed
                </option>
                `;

        }

    }

}


/* ============================================================
   LOAD CSV
============================================================ */

async function loadCSV(
    filename
) {

    const url =
        filename +
        "?v=" +
        Date.now();


    console.log(
        "Fetching CSV:",
        url
    );


    const response =
        await fetch(
            url,
            {
                method: "GET",
                cache: "no-store"
            }
        );


    console.log(
        "HTTP status:",
        response.status
    );


    console.log(
        "HTTP OK:",
        response.ok
    );


    if (
        !response.ok
    ) {

        throw new Error(
            `${filename} HTTP ${response.status}`
        );

    }


    const text =
        await response.text();


    console.log(
        `${filename} size:`,
        text.length,
        "characters"
    );


    console.log(
        `${filename} first 500 characters:`,
        text.substring(
            0,
            500
        )
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


/* ============================================================
   CSV PARSER
============================================================ */

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

        else if (
            char === "," &&
            !insideQuotes
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

            cell = "";

        }

        else {

            cell += char;

        }

    }


    if (
        cell !== "" ||
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
        rows.length < 2
    ) {

        return [];

    }


    const headers =
        rows[0].map(
            header =>
                cleanText(
                    header
                )
        );


    console.log(
        "CSV HEADERS:",
        headers
    );


    return rows
        .slice(1)
        .map(
            values => {

                const object = {};


                headers.forEach(
                    (
                        header,
                        index
                    ) => {

                        object[header] =
                            cleanText(
                                values[index] || ""
                            );

                    }
                );


                return object;

            }
        );

}


/* ============================================================
   CLEAN TEXT
============================================================ */

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


/* ============================================================
   NUMBER
============================================================ */

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


    const number =
        parseFloat(
            cleaned
        );


    return Number.isFinite(
        number
    )
        ? number
        : 0;

}


/* ============================================================
   NORMALIZE IPO NAME
============================================================ */

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


/* ============================================================
   DATE PARSER
============================================================ */

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


    text =
        text.replace(
            /\s*GMP\s*:.*$/i,
            ""
        )
        .trim();


    /* YYYY-MM-DD */

    let match =
        text.match(
            /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
        );


    if (
        match
    ) {

        return new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        );

    }


    /* DD-MM-YYYY */

    match =
        text.match(
            /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/
        );


    if (
        match
    ) {

        return new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1])
        );

    }


    /* DD-MMM-YYYY */

    match =
        text.match(
            /^(\d{1,2})[- ]([A-Za-z]{3,9})[- ](\d{4})/
        );


    if (
        match
    ) {

        const month =
            monthNumber(
                match[2]
            );


        if (
            month !== null
        ) {

            return new Date(
                Number(match[3]),
                month,
                Number(match[1])
            );

        }

    }


    /* DD-MMM */

    match =
        text.match(
            /^(\d{1,2})[- ]([A-Za-z]{3,9})/
        );


    if (
        match
    ) {

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
                Number(match[1])
            );

        }

    }


    /* Native date */

    const date =
        new Date(
            text
        );


    if (
        !Number.isNaN(
            date.getTime()
        )
    ) {

        return new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
        );

    }


    return null;

}


/* ============================================================
   MONTH
============================================================ */

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


/* ============================================================
   SORT
============================================================ */

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


/* ============================================================
   CLEAN CURRENT DATA
============================================================ */

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


/* ============================================================
   CLEAN HISTORY DATA
============================================================ */

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


/* ============================================================
   POPULATE DROPDOWN
============================================================ */

function populateDropdown() {

    if (
        !ipoSelect
    ) {

        console.error(
            "ipoSelect not found"
        );

        return;

    }


    ipoSelect.innerHTML =
        "";


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


    currentData.forEach(
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


    console.log(
        "Dropdown options:",
        ipoSelect.options.length
    );

}


/* ============================================================
   TABLE
============================================================ */

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


/* ============================================================
   SEARCH
============================================================ */

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


/* ============================================================
   IPO SELECT
============================================================ */

if (
    ipoSelect
) {

    ipoSelect.addEventListener(
        "change",
        function () {

            const ipoName =
                this.value;


            console.log(
                "Selected IPO:",
                ipoName
            );


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


/* ============================================================
   GET IPO HISTORY
============================================================ */

function getIPOHistory(
    ipoName
) {

    const target =
        normalize(
            ipoName
        );


    return historyData.filter(
        row =>
            normalize(
                row["IPO Name"]
            ) === target
    );

}


/* ============================================================
   DRAW CHART
============================================================ */

function drawChart(
    ipoName
) {

    console.log(
        "======================================"
    );

    console.log(
        "DRAW CHART:",
        ipoName
    );


    let rows =
        getIPOHistory(
            ipoName
        );


    console.log(
        "History rows:",
        rows
    );


    /* --------------------------------------------------------
       CONVERT DATA
    -------------------------------------------------------- */

    rows =
        rows
            .map(
                row => {

                    return {

                        date:
                            parseDate(
                                row["Date"]
                            ),

                        gmp:
                            toNumber(
                                row["GMP %"]
                            )

                    };

                }
            )
            .filter(
                row =>
                    row.date !== null
            );


    /* --------------------------------------------------------
       SORT ASCENDING
    -------------------------------------------------------- */

    rows.sort(
        (a, b) =>
            a.date - b.date
    );


    /* --------------------------------------------------------
       ONE VALUE PER DATE
    -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       FINAL POINTS
    -------------------------------------------------------- */

    const points =
        Array.from(
            dateMap.values()
        )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    console.log(
        "FINAL CHART POINTS:",
        points
    );


    /* --------------------------------------------------------
       FALLBACK
    -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       NO DATA
    -------------------------------------------------------- */

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
            `⚠️ No GMP history found for ${ipoName}`
        );


        return;

    }


    /* --------------------------------------------------------
       LABELS
    -------------------------------------------------------- */

    const labels =
        points.map(
            point =>
                point.date.toLocaleDateString(
                    "en-IN",
                    {
                        day:
                            "2-digit",

                        month:
                            "short"
                    }
                )
        );


    /* --------------------------------------------------------
       VALUES
    -------------------------------------------------------- */

    const values =
        points.map(
            point =>
                point.gmp
        );


    /* --------------------------------------------------------
       DESTROY OLD
    -------------------------------------------------------- */

    destroyChart();


    /* --------------------------------------------------------
       TITLE
    -------------------------------------------------------- */

    if (
        chartTitle
    ) {

        chartTitle.textContent =
            `${ipoName} — GMP % Trend`;

    }


    /* --------------------------------------------------------
       CREATE CHART
    -------------------------------------------------------- */

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


                            borderWidth:
                                3,


                            pointRadius:
                                4,


                            pointHoverRadius:
                                7,


                            tension:
                                0,


                            fill:
                                false,


                            spanGaps:
                                false

                        }

                    ]

                },


                options: {

                    responsive:
                        true,


                    maintainAspectRatio:
                        false,


                    interaction: {

                        intersect:
                            false,

                        mode:
                            "index"

                    },


                    plugins: {

                        legend: {

                            display:
                                true

                        },


                        tooltip: {

                            callbacks: {

                                title:
                                    function(
                                        context
                                    ) {

                                        const point =
                                            points[
                                                context[0]
                                                    .dataIndex
                                            ];


                                        return point
                                            ? point.date
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
                                                )
                                            : "";

                                    },


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


    setStatus(
        `📈 ${ipoName}: ${points.length} daily GMP values plotted`
    );

}


/* ============================================================
   DATE KEY
============================================================ */

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


/* ============================================================
   DESTROY CHART
============================================================ */

function destroyChart() {

    if (
        gmpChart
    ) {

        gmpChart.destroy();

        gmpChart =
            null;

    }

}


/* ============================================================
   STATUS
============================================================ */

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


/* ============================================================
   AUTO REFRESH
============================================================ */

setInterval(
    function () {

        console.log(
            "Refreshing IPO data..."
        );

        loadDashboard();

    },
    5 * 60 * 1000
);
```
