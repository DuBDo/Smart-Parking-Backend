const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const authRouter = require("./routes/auth.routes");
const driverRouter = require("./routes/driver.routes");
require('./config/passport');

dotenv.config();

const app = express();

const port = process.env.PORT;

app.use(cors({
    origin:'http://localhost:5173',
    credentials:true
}))

app.use(express.json());
app.use(express.urlencoded({extended:true}));

app.use("/api/V1/auth", authRouter);
app.use("/api/V1/driver", driverRouter);

const startServer = async () => {
  try {
    await connectDB(); 
    app.listen(port, () => console.log(`Server running on port ${port}`));
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();