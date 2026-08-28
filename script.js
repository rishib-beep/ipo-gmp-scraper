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


        // Current data

        currentData =
            await loadCSV(
                CURRENT_CSV
            );


        console.log(
            "Current IPO rows:",
            currentData.length
        );


        // History

        try {

            historyData =
                await loadCSV(
                    HISTORY_CSV
                );

        } catch (error) {

            console.warn(
                "History CSV unavailable",
                error
            );

            historyData = [];

        }


        console.log(
            "History rows:",
            historyData.length
        );


        // Clean

        currentData =
            cleanCurrentData(
                currentData
            );


        historyData =
            cleanHistoryData(
                historyData
            );


        // Sort latest listing first

        currentData.sort(
            sortByListingDate
        );


        // Render

        renderTable(
            currentData
        );


        populateDropdown();


        setStatus(
            `✅ ${currentData.length} IPOs loaded | ${historyData.length} historical records`
        );


        // Restore previous selection

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


    } catch (error) {

        console.error(
            error
        );


        setStatus(
            "❌ Unable to load IPO data. Check browser Console."
        );


        ipoSelect.innerHTML =
            '<option value="">Unable to load IPO data</option>';

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

        rows.push(
            row
        );

    }


    if (
        rows.length < 2
    ) {

        return [];

    }


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
// TEXT
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
        value === undefined
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
        );


    return Number.isFinite(
        n
    )
        ? n
        : 0;

}


// ============================================================
// IPO NAME
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
// DATE
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


    // DD-MMM

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


    return null;

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
// CLEAN CURRENT
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
// CLEAN HISTORY
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

    ipoSelect.innerHTML = "";


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


// ============================================================
// SEARCH
// ============================================================

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


// ============================================================
// IPO SELECTION
// ============================================================

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


// ============================================================
// GET HISTORY
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

function drawChart(
    ipoName
) {

    let rows =
        getIPOHistory(
            ipoName
        );


    console.log(
        "Selected IPO:",
        ipoName
    );


    console.log(
        "History rows:",
        rows
    );


    // --------------------------------------------------------
    // SORT DATE ASCENDING
    // --------------------------------------------------------

    rows =
        rows
            .filter(
                row =>
                    parseDate(
                        row["Date"]
                    )
            )
            .sort(
                (a, b) =>
                    parseDate(
                        a["Date"]
                    ) -
                    parseDate(
                        b["Date"]
                    )
            );


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
                        toNumber(
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


    if (
        points.length === 0
    ) {

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

    chartTitle.textContent =
        `${ipoName} — GMP % Trend`;


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

                            borderWidth:
                                2,

                            pointRadius:
                                3,

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
        `📈 ${ipoName}: ${points.length} GMP date(s) plotted`
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

setInterval(
    function () {

        loadDashboard();

    },
    5 * 60 * 1000
);
