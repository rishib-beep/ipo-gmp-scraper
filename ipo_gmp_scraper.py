```html
<!DOCTYPE html>

<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>
        IPO GMP Analysis Dashboard
    </title>


    <!-- Chart.js -->

    <script
        src="https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js">
    </script>


    <style>

        * {
            box-sizing: border-box;
        }

        body {

            margin: 0;

            font-family:
                Arial,
                Helvetica,
                sans-serif;

            background: #f5f7fa;

            color: #222;
        }


        .container {

            width: 100%;

            max-width: 1500px;

            margin: auto;

            padding: 15px;
        }


        h1 {

            margin: 5px 0;

            font-size: 28px;
        }


        .subtitle {

            color: #666;

            margin-bottom: 15px;
        }


        /* =====================================================
           CONTROLS
           ===================================================== */

        .controls {

            display: flex;

            flex-wrap: wrap;

            gap: 15px;

            margin-bottom: 15px;
        }


        .control-group {

            flex: 1;

            min-width: 250px;
        }


        label {

            display: block;

            font-weight: bold;

            margin-bottom: 6px;
        }


        select,
        input {

            width: 100%;

            padding: 10px;

            border: 1px solid #ccc;

            border-radius: 6px;

            background: white;

            font-size: 15px;
        }


        /* =====================================================
           CHART
           ===================================================== */

        .chart-card {

            background: white;

            border-radius: 10px;

            padding: 15px;

            margin-bottom: 15px;

            box-shadow:
                0 2px 8px
                rgba(0,0,0,0.08);
        }


        .chart-header {

            display: flex;

            justify-content: space-between;

            align-items: center;

            flex-wrap: wrap;

            margin-bottom: 5px;
        }


        .chart-header h2 {

            margin: 0;
        }


        .chart-container {

            position: relative;

            width: 100%;

            height: 280px;
        }


        /* =====================================================
           STATUS
           ===================================================== */

        .status {

            padding: 10px;

            margin-bottom: 15px;

            background: white;

            border-radius: 6px;

            color: #555;
        }


        /* =====================================================
           TABLE
           ===================================================== */

        .table-card {

            background: white;

            border-radius: 10px;

            padding: 10px;

            box-shadow:
                0 2px 8px
                rgba(0,0,0,0.08);
        }


        .table-title {

            padding: 5px 10px;

            margin: 0;
        }


        .table-wrapper {

            width: 100%;

            overflow-x: auto;
        }


        table {

            width: 100%;

            border-collapse: collapse;

            min-width: 1300px;
        }


        th {

            background: #1f2937;

            color: white;

            padding: 10px;

            text-align: left;

            white-space: nowrap;
        }


        td {

            padding: 9px;

            border-bottom:
                1px solid #e5e7eb;

            white-space: nowrap;
        }


        tbody tr:hover {

            background: #f3f4f6;
        }


        /* =====================================================
           MOBILE
           ===================================================== */

        @media (
            max-width: 768px
        ) {

            .container {

                padding: 10px;
            }


            h1 {

                font-size: 22px;
            }


            .control-group {

                min-width: 100%;
            }


            .chart-container {

                height: 230px;
            }


            .chart-header h2 {

                font-size: 18px;
            }

        }


        @media (
            max-width: 480px
        ) {

            .chart-container {

                height: 210px;
            }

        }

    </style>

</head>


<body>


<div class="container">


    <!-- =====================================================
         HEADER
         ===================================================== -->

    <h1>
        📊 IPO GMP Analysis Dashboard
    </h1>


    <div class="subtitle">

        Live IPO Grey Market Premium & GMP Trend

    </div>


    <!-- =====================================================
         CONTROLS
         ===================================================== -->

    <div class="controls">


        <div class="control-group">

            <label for="ipoSelect">
                GMP Trend
            </label>


            <select id="ipoSelect">

                <option value="">
                    Select IPO
                </option>

            </select>

        </div>


        <div class="control-group">

            <label for="searchBox">
                Search IPO
            </label>


            <input
                type="text"
                id="searchBox"
                placeholder="Search IPO..."
            >

        </div>


    </div>


    <!-- =====================================================
         CHART
         ===================================================== -->

    <div class="chart-card">


        <div class="chart-header">

            <div>

                <h2 id="chartTitle">
                    GMP % Trend
                </h2>

                <small>
                    X-axis: Date |
                    Y-axis: GMP %
                </small>

            </div>

        </div>


        <div class="chart-container">

            <canvas
                id="gmpChart">
            </canvas>

        </div>


    </div>


    <!-- =====================================================
         STATUS
         ===================================================== -->

    <div
        class="status"
        id="status">

        Loading GMP data...

    </div>


    <!-- =====================================================
         CURRENT IPO TABLE
         ===================================================== -->

    <div class="table-card">


        <h2 class="table-title">

            Current IPO GMP

        </h2>


        <div class="table-wrapper">


            <table>


                <thead>

                    <tr>

                        <th>IPO Name</th>

                        <th>GMP</th>

                        <th>GMP %</th>

                        <th>GMP Down</th>

                        <th>GMP Up</th>

                        <th>Subscription</th>

                        <th>IPO Price</th>

                        <th>IPO Size</th>

                        <th>Lot Size</th>

                        <th>Open</th>

                        <th>Close</th>

                        <th>BOA Date</th>

                        <th>Listing Date</th>

                        <th>Updated</th>

                        <th>Anchor</th>

                        <th>Estimated Listing</th>

                    </tr>

                </thead>


                <tbody
                    id="ipoTableBody">
                </tbody>


            </table>


        </div>


    </div>


</div>


<!-- =========================================================
     JAVASCRIPT
     ========================================================= -->

<script src="script.js"></script>


</body>

</html>
```
