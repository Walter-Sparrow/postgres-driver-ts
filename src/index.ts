import { createConnection } from "./conn.js";

const user = process.env.USER || "postgres";
const password = process.env.PASS || "";
const database = process.env.DATABASE || "postgres";

const conn = createConnection(
  {
    user,
    password,
    database,
    host: "localhost",
    port: 5432,
  },
  () => {
    conn
      .simpleQuery("SELECT * FROM users")
      .then((result) => console.log(result));
  }
);
