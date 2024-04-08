const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("users.db");

db.serialize(() => {
  db.run(
    "CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, email TEXT UNIQUE, password TEXT)",
    (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Таблица users создана");
      }
    }
  );

  db.run(
    "CREATE TABLE IF NOT EXISTS tasks (task_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, description TEXT, completed INTEGER, FOREIGN KEY (user_id) REFERENCES users(user_id))",
    (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log("Таблица tasks создана");
      }
    }
  );
});

db.close((err) => {
  if (err) {
    return console.error(err.message);
  }
});
