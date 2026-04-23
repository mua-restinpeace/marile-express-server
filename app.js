const express  = require("express");
const morgan = require("morgan");
const cors = require ("cors");
require("dotenv/config");

const app = express();
const env = process.env;
const port = env.PORT;
const host = env.HOSTNAME;
const api = env.API_URL

app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(morgan("dev"));
app.use(cors());

app.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}`)
})