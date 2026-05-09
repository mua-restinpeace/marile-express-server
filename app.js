require("dotenv/config");

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const { errorHandler, notFound } = require("./src/middleware/errorHandler");
const prisma = require("./src/config/prisma");

const app = express();
const env = process.env;
const port = env.PORT;
const host = env.HOSTNAME;
const api = env.API_URL;

// Midleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cors());
app.use(cookieParser());

// Routes
const authRouter = require('./src/routes/auth');
const userRouter = require('./src/routes/user');
const inventoryRouter = require('./src/routes/inventory');
const productRouter = require('./src/routes/products');
const transactionRouter = require('./src/routes/transactions');
const dashboardRouter = require('./src/routes/dashboard');
const { seed } = require("./src/seeder");

app.use(`${api}/products`, productRouter);
app.use(`${api}/auth`, authRouter);
app.use(`${api}/users`, userRouter);
app.use(`${api}/inventory`, inventoryRouter);
app.use(`${api}/transactions`, transactionRouter);
app.use(`${api}/dashboard`, dashboardRouter);


// Error Handling
app.use(notFound);
app.use(errorHandler);

async function bootsrap() {
  try {
    await prisma.$connect();
    console.log("Connected to MySQL via Prisma");
    await seed();

    app.listen(port, host, () => {
      console.log(`Server running at http://${host}:${port}`);
    });
  } catch (err) {
    console.log("Failed to start server: ", err);
    process.exit(1);
  }
}

bootsrap()