const express  = require("express");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const cors = require ("cors");
require("dotenv/config");

const app = express();
const env = process.env;
const port = env.PORT;
const host = env.HOSTNAME;
const api = env.API_URL

app.use(bodyParser.json());
app.use(morgan("tiny"));
app.use(cors());

app.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`)
})