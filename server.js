const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const saltRounds = 10;
const databaseFile = "users.db";

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(cors());

const generateSecretKey = () => {
  return crypto.randomBytes(32).toString("hex");
};

const createJWT = (payload, secretKey, expiresIn = "30d") => {
  return jwt.sign(payload, secretKey, { expiresIn });
};

app.post("/register", async (req, res) => {
  const db = new sqlite3.Database(databaseFile);
  try {
    const { username, email, password } = req.body;

    const existingUser = await new Promise((resolve, reject) => {
      db.get(
        "SELECT * FROM users WHERE email = ?",
        [email],
        (err, existingUser) => {
          if (err) {
            reject(err);
          } else {
            resolve(existingUser);
          }
        }
      );
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [username, email, hashedPassword],
        (insertErr) => {
          if (insertErr) {
            reject(insertErr);
          } else {
            resolve();
          }
        }
      );
    });

    const userData = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
          db.close();
        }
      });
    });

    delete userData.password;

    const secretKey = generateSecretKey();

    const token = createJWT(userData, secretKey);

    const user = {
      jwt: token,
      userData,
    };

    return res
      .status(200)
      .json({ message: "User registered successfully", user });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ message: "Failed to register user" });
  }
});

app.post("/auth", async (req, res) => {
  const db = new sqlite3.Database(databaseFile);
  try {
    const { email, password } = req.body;

    const existingUser = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (existingUser) {
      const passwordMatch = await bcrypt.compare(
        password,
        existingUser.password
      );

      if (passwordMatch) {
        const tasks = await new Promise((resolve, reject) => {
          db.all(
            "SELECT * FROM tasks WHERE user_id = ?",
            [existingUser.user_id],
            (err, rows) => {
              if (err) {
                reject(err);
              } else {
                resolve(rows);
                db.close();
              }
            }
          );
        });

        delete existingUser.password;

        const userData = {
          user_id: existingUser.user_id,
          username: existingUser.username,
          email: existingUser.email,
        };

        const secretKey = generateSecretKey();

        const token = createJWT(userData, secretKey);

        const user = {
          jwt: token,
          userData,
          tasks: tasks,
        };
        res
          .status(200)
          .json({ message: "User authenticated successfully", user });
      } else {
        res.status(401).json({ message: "Incorrect email or password" });
      }
    } else {
      res.status(401).json({ message: "Incorrect email or password" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/change-username", async (req, res) => {
  const db = new sqlite3.Database(databaseFile);
  try {
    const { userId, newUsername } = req.body;

    await new Promise((resolve, reject) => {
      db.run(
        "UPDATE users SET username = ? WHERE user_id = ?",
        [newUsername, userId],
        (updateErr) => {
          if (updateErr) {
            reject(updateErr);
          } else {
            resolve();
          }
        }
      );
    });

    const username = await new Promise((resolve, reject) => {
      db.get(
        "SELECT username FROM users WHERE user_id = ?",
        [userId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row.username);
            db.close();
          }
        }
      );
    });

    res.status(200).json({
      message: "Username changed successfully",
      newUsername: username,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/add-task", async (req, res) => {
  const db = new sqlite3.Database(databaseFile);
  try {
    const { userId, title, description } = req.body;

    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO tasks (user_id, title, description, completed) VALUES (?, ?, ?, ?)",
        [userId, title, description, 0],
        (insertErr) => {
          if (insertErr) {
            reject(insertErr);
          } else {
            resolve();
          }
        }
      );
    });

    const tasks = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM tasks WHERE user_id = ?", [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
          db.close();
        }
      });
    });

    res.status(200).json({ message: "Task added successfully", tasks });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/remove-task", async (req, res) => {
  const db = new sqlite3.Database(databaseFile);
  try {
    const { userId, taskId } = req.body;

    await new Promise((resolve, reject) => {
      db.run("DELETE FROM tasks WHERE task_id = ?", [taskId], (deleteErr) => {
        if (deleteErr) {
          reject(deleteErr);
        } else {
          resolve();
        }
      });
    });

    const tasks = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM tasks WHERE user_id = ?", [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
          db.close();
        }
      });
    });

    res.status(200).json({ message: "Task removed successfully", tasks });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/edit-task", async (req, res) => {
  const db = new sqlite3.Database(databaseFile);
  try {
    const { userId, taskId, title, description } = req.body;

    await new Promise((resolve, reject) => {
      db.run(
        "UPDATE tasks SET title = ?, description = ? WHERE task_id = ?",
        [title, description, taskId],
        (updateErr) => {
          if (updateErr) {
            reject(updateErr);
          } else {
            resolve();
          }
        }
      );
    });

    const tasks = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM tasks WHERE user_id = ?", [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
          db.close();
        }
      });
    });

    res.status(200).json({ message: "Task edited successfully", tasks });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/complete-task", async (req, res) => {
  const db = new sqlite3.Database(databaseFile);
  try {
    const { userId, taskId, taskStatus } = req.body;

    const newStatus = taskStatus == 0 ? 1 : 0;

    await new Promise((resolve, reject) => {
      db.run(
        "UPDATE tasks SET completed = ? WHERE task_id = ?",
        [newStatus, taskId],
        (updateErr) => {
          if (updateErr) {
            reject(updateErr);
          } else {
            resolve();
          }
        }
      );
    });

    const tasks = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM tasks WHERE user_id = ?", [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
          db.close();
        }
      });
    });

    res.status(200).json({ message: "Task completed", tasks });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/get-tasks", async (req, res) => {
  const db = new sqlite3.Database(databaseFile);
  try {
    const { userId } = req.body;

    const tasks = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM tasks WHERE user_id = ?", [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
          db.close();
        }
      });
    });

    res.status(200).json({ message: "Sending all tasks", tasks });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
