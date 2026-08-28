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
    console.log("IPO GMP DASHBOARD");
    console.log("======================================");

    ipoSelect =
        document.getElementById("ipoSelect");

    searchBox =
        document.getElementById("searchBox");

    tableBody =
        document.getElementById("ipoTableBody");

    statusBox =
        document.getElementById("status");

    chartTitle =
        document.getElementById("chartTitle");

    chartCanvas =
        document.getElementById("gmpChart");


    loadDashboard();

});


/* ============================================================
   LOAD DASHBOARD
============================================================ */

async function loadDashboard() {

    try {

        setStatus(
            "⏳ Loading IPO GMP data..."
        );


        /* ----------------------------------------------------
           CURRENT DATA
        ---------------------------------------------------- */

        currentData =
            await loadCSV(
                CURRENT_CSV
            );


        console.log(
            "Current CSV rows:",
            currentData.length
        );


        /* ----------------------------------------------------
           HISTORY DATA
        ---------------------------------------------------- */

        try {

            historyData =
                await loadCSV(
                    HISTORY_CSV
                );


            console.log(
                "History CSV rows:",
                historyData.length
            );

        }

        catch (error) {

            console.warn(
                "History CSV unavailable:",
                error
            );

            historyData = [];

        }


        /* ----------------------------------------------------
           CLEAN
        ---------------------------------------------------- */

        currentData =
            cleanCurrentData(
                currentData
            );


        historyData =
            cleanHistoryData(
                historyData
            );


        console.log(
            "Clean current rows:",
            currentData.length
        );


        console.log(
            "Clean history rows:",
            historyData.length
        );


        /* ----------------------------------------------------
           SORT CURRENT
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
            "Dashboard loading error:",
            error
        );


        setStatus(
            "❌ Unable to load IPO data. Check browser Console."
        );


        if (
            ipoSelect
        ) {

            ipoSelect.innerHTML =
                `
                <option value="">
                    Unable to load IPO data
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
        "Fetching:",
        url
    );


    const response =
        await fetch(
            url,
            {
                cache:
                    "no-store"
            }
        );


    console.log(
        filename,
        "HTTP:",
        response.status
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


    console.log(
        filename,
        "size:",
        text.length
    );


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
            value =>
                cleanText(
                    value
                )
        );


    console.log(
        "CSV headers:",
        headers
    );


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


    /* Remove GMP suffix */

    text =
        text
            .replace(
                /\s*GMP\s*:.*$/i,
                ""
            )
            .trim();


    /* --------------------------------------------------------
       YYYY-MM-DD
    -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       DD-MM-YYYY
    -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       DD-MMM-YYYY
    -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       DD-MMM
    -------------------------------------------------------- */

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


    /* --------------------------------------------------------
       Native date
    -------------------------------------------------------- */

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
            .toLowerCase()
            .trim();


    return Object.prototype.hasOwnProperty.call(
        months,
        key
    )
        ? months[key]
        : null;

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
   SORT LISTING DATE
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
===============================================================
   IMPORTANT:

   Actual CSV columns are:

   IPO Name
   GMP Numeric
   GMP %
   Data Date
   Data Time
   Last Updated
============================================================ */

function cleanHistoryData(
    data
) {

    return data
        .filter(
            row => {

                return (
                    row["IPO Name"] &&
                    (
                        row["Data Date"] ||
                        row["Date"]
                    )
                );

            }
        )
        .map(
            row => {

                /* ------------------------------------------------
                   SUPPORT BOTH OLD AND NEW COLUMN NAMES
                ------------------------------------------------ */

                row["_date"] =
                    row["Data Date"] ||
                    row["Date"] ||
                    "";


                row["_gmp"] =
                    toNumber(
                        row["GMP Numeric"] ||
                        row["GMP"]
                    );


                row["_gmpPercent"] =
                    toNumber(
                        row["GMP %"]
                    );


                row["_time"] =
                    row["Data Time"] ||
                    "";


                row["_lastUpdated"] =
                    row["Last Updated"] ||
                    "";


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
   DROPDOWN
============================================================ */

function populateDropdown() {

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


    console.log(
        "Dropdown IPO count:",
        ipoSelect.options.length - 1
    );

}


/* ============================================================
   TABLE
============================================================ */

function renderTable(
    data
) {

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
                        field === "Estimated Listing Price"
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
   IPO SELECTION
============================================================ */

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


                chartTitle.textContent =
                    "GMP % Trend";


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
   DRAW GMP CHART
============================================================ */

function drawChart(
    ipoName
) {

    console.log(
        "======================================"
    );

    console.log(
        "DRAWING CHART:",
        ipoName
    );


    let rows =
        getIPOHistory(
            ipoName
        );


    console.log(
        "Matching history records:",
        rows.length
    );


    /* --------------------------------------------------------
       CONVERT HISTORY
    -------------------------------------------------------- */

    const converted =
        rows
            .map(
                row => {

                    const date =
                        parseDate(
                            row["_date"]
                        );


                    return {

                        date:
                            date,

                        gmp:
                            row["_gmpPercent"],

                        time:
                            row["_time"],

                        updated:
                            row["_lastUpdated"]

                    };

                }
            )
            .filter(
                row =>
                    row.date !== null
            );


    /* --------------------------------------------------------
       SORT BY DATE + TIME
    -------------------------------------------------------- */

    converted.sort(
        function (
            a,
            b
        ) {

            const dateDifference =
                a.date - b.date;


            if (
                dateDifference !== 0
            ) {

                return dateDifference;

            }


            return String(
                a.time
            )
                .localeCompare(
                    String(
                        b.time
                    )
                );

        }
    );


    /* --------------------------------------------------------
       ONE VALUE PER DAY
       
       IMPORTANT:
       If there are several updates on the same day,
       use the LAST update of that day.
       
       Example:

       18:07 → GMP 13.7
       18:21 → GMP 14.0
       18:22 → GMP 14.4

       Chart uses 14.4 for that date.
    -------------------------------------------------------- */

    const dailyMap =
        new Map();


    converted.forEach(
        point => {

            const key =
                getDateKey(
                    point.date
                );


            dailyMap.set(
                key,
                point
            );

        }
    );


    /* --------------------------------------------------------
       FINAL DAILY POINTS
    -------------------------------------------------------- */

    const points =
        Array.from(
            dailyMap.values()
        )
            .sort(
                (a, b) =>
                    a.date - b.date
            );


    console.log(
        "Daily chart points:",
        points
    );


    /* --------------------------------------------------------
       FALLBACK TO CURRENT GMP
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
                    ),

                time:
                    "",

                updated:
                    ""

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


        chartTitle.textContent =
            `${ipoName} — GMP % Trend`;


        setStatus(
            `⚠️ No GMP history available for ${ipoName}`
        );


        return;

    }


    /* --------------------------------------------------------
       LABELS
    -------------------------------------------------------- */

    const labels =
        points.map(
            point => {

                return point.date.toLocaleDateString(
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
        );


    /* --------------------------------------------------------
       VALUES
    -------------------------------------------------------- */

    const values =
        points.map(
            point =>
                point.gmp
        );


    console.log(
        "Chart labels:",
        labels
    );


    console.log(
        "Chart values:",
        values
    );


    /* --------------------------------------------------------
       DESTROY OLD CHART
    -------------------------------------------------------- */

    destroyChart();


    /* --------------------------------------------------------
       TITLE
    -------------------------------------------------------- */

    chartTitle.textContent =
        `${ipoName} — GMP % Trend`;


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
                                5,


                            pointHoverRadius:
                                8,


                            tension:
                                0,


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
                                    function (
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


                                        return point.date
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


    /* --------------------------------------------------------
       STATUS
    -------------------------------------------------------- */

    setStatus(
        `📈 ${ipoName}: ${points.length} daily GMP values plotted`
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
            "Refreshing IPO GMP data..."
        );


        loadDashboard();

    },
    5 * 60 * 1000
);
```
