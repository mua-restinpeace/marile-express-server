require("dotenv/config");

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const path = require("path");

const { errorHandler, notFound } = require("./src/middleware/errorHandler");
const prisma = require("./src/config/prisma");

const app = express();
const env = process.env;
const port = env.PORT;
const host = env.HOST;
const api = env.API_URL;

// Midleware
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(
  cors({
    origin:
      env.NODE_ENV == "production" ? env.CLIENT_URL : "http://localhost:3001",
    credentials: true,
  }),
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
const authRouter = require("./src/routes/auth");
const userRouter = require("./src/routes/user");
const inventoryRouter = require("./src/routes/inventory");
const productRouter = require("./src/routes/products");
const transactionRouter = require("./src/routes/transactions");
const dashboardRouter = require("./src/routes/dashboard");
const publicRouter = require("./src/routes/public");
const exportRouter = require("./src/routes/export");
const { seed } = require("./src/seeder");

app.use(`${api}/products`, productRouter);
app.use(`${api}/auth`, authRouter);
app.use(`${api}/users`, userRouter);
app.use(`${api}/inventory`, inventoryRouter);
app.use(`${api}/transactions`, transactionRouter);
app.use(`${api}/dashboard`, dashboardRouter);
app.use(`${api}/public`, publicRouter);
app.use(`${api}/export`, exportRouter);

// Error Handling
app.use((err, req, res, next) => {
  if (err.code === "LIMIT_FILE_SIZE") {
    return res
      .status(400)
      .json({ success: false, message: "Image file size must be under 20MB" });
  }

  if (err.message === "Only JPEG, PNG, WebP images are allowed") {
    return res.status(400).json({ success: false, message: err.message });
  }

  next(err);
});
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

bootsrap();
