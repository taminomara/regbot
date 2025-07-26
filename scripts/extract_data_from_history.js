import * as fs from "fs";
import { exit } from "process";

const file = process.argv[2];
if (!file) {
  console.log("Usage: extract_data_from_history.ts path.json");
  exit(1);
}

const raw = fs.readFileSync(file, "utf8");
const data = JSON.parse(raw)["messages"];

if (!data) {
  console.log("Invalid json");
  exit(1);
}

const users = {};
const unknownUsers = {};
const userByTopic = {};
let nApproved = 0;
let nRejected = 0;
let nBanned = 0;

for (let i = 0; i < data.length; i++) {
  const msg = data[i];

  if (msg["type"] === "service" && msg["action"] === "topic_edit") {
    console.log("Warning: user name change", msg["new_title"]);
    continue;
  }

  if (msg["type"] !== "message") {
    continue;
  }

  const text = msg["text_entities"];

  if (text === undefined || text.length === 0) {
    continue;
  }

  const extract = (i, t) =>
    text[i - 1]["text"] === t ? text[i]["text"] : null;

  if (/^Диалог с пользователем /.test(text[0]["text"])) {
    let user = {};
    if (text[1]["type"] === "mention_name") {
      const userId = text[1]["user_id"];
      if (users[userId] !== undefined) {
        console.log(`Warning: duplicate header for user ${userId}`);
        continue;
      }
      users[userId] = user;

      user["username"] = text[3]["text"];
      user["name"] = extract(6, "\n\nИмя: ");
      user["pronouns"] = extract(8, "\nМестоимения: ");
      user["gender"] = extract(10, "\nГендерная идентичность: ");
      user["sexuality"] = extract(12, "\nСексуальная идентичность: ");
      user["positioning"] = extract(14, "\nПозиционирование: ");
      user["isApproved"] = false;
      user["isBanned"] = false;
      user["adminGroupTopic"] = msg["reply_to_message_id"];
    } else if (text[1]["type"] === "mention") {
      const username = text[1]["text"].slice(1);
      if (unknownUsers[username] !== undefined) {
        console.log(`Warning: duplicate header for user ${username}`);
        continue;
      }
      unknownUsers[username] = user;

      user["username"] = username;
      user["name"] = extract(4, "\n\nИмя: ");
      user["pronouns"] = extract(6, "\nМестоимения: ");
      user["gender"] = extract(8, "\nГендерная идентичность: ");
      user["sexuality"] = extract(10, "\nСексуальная идентичность: ");
      user["positioning"] = extract(12, "\nПозиционирование: ");
      user["isApproved"] = false;
      user["isRejected"] = false;
      user["isBanned"] = false;
      user["adminGroupTopic"] = msg["reply_to_message_id"];
    }
    userByTopic[user["adminGroupTopic"]] = user;
  } else if (
    text[0]["type"] === "plain" &&
    text[0]["text"] === "✅ Пользователь верифицирован админом "
  ) {
    userByTopic[msg["reply_to_message_id"]]["isApproved"] = true;
    nApproved += 1;
  } else if (
    text[0]["type"] === "plain" &&
    text[0]["text"] === "❌ Пользователь отклонён админом "
  ) {
    userByTopic[msg["reply_to_message_id"]]["isRejected"] = true;
    nRejected += 1;
  } else if (
    text[0]["type"] === "plain" &&
    text[0]["text"] === "⛔ Пользователь забанен админом "
  ) {
    userByTopic[msg["reply_to_message_id"]]["isBanned"] = true;
    nBanned += 1;
  }
}

const userList = [];
for (const userId in users) {
  const user = users[userId];
  let status;
  if (user["isApproved"] && user["isRejected"]) {
    console.log(
      `Warning: user ${user["username"]} is both approved and rejected`,
    );
  }
  if (user["isBanned"]) {
    status = "Banned";
  } else if (user["isApproved"]) {
    status = "Approved";
  } else if (user["isRejected"]) {
    status = "Rejected";
  } else {
    status = "New";
  }

  userList.push(
    JSON.stringify({
      id: userId,
      status: status,
      admin_group_topic: user["adminGroupTopic"],
      username: user["username"],
      name: user["name"],
      pronouns: user["pronouns"],
      gender: user["gender"],
      sexuality: user["sexuality"],
      positioning: user["positioning"],
      has_unverified_fields: status === "Approved",
    }),
  );
}
fs.writeFileSync("./users.json", userList.join("\n"));

const inviteList = [];
for (const username in unknownUsers) {
  const user = unknownUsers[username];
  let status;
  if (user["isApproved"] && user["isRejected"]) {
    console.log(
      `Warning: user ${user["username"]} is both approved and rejected`,
    );
  }
  if (user["isBanned"]) {
    status = "Banned";
  } else if (user["isApproved"]) {
    status = "Approved";
  } else if (user["isRejected"]) {
    status = "Rejected";
  } else {
    status = "New";
  }

  if (status === "Rejected") {
    continue;
  }

  inviteList.push(
    JSON.stringify({
      admin_group_topic: user["adminGroupTopic"],
      username: user["username"],
      name: user["name"],
      pronouns: user["pronouns"],
      gender: user["gender"],
      sexuality: user["sexuality"],
      positioning: user["positioning"],
      is_banned: user["isBanned"],
    }),
  );
}
fs.writeFileSync("./invitations.json", inviteList.join("\n"));

console.log(userList.length, "users", inviteList.length, "invites");
console.log(nApproved, "approved,", nRejected, "rejected", nBanned, "banned");
console.log("Apply this data:");
console.log("");
console.log("sqlite-utils insert dev.db user ./users.json --nl --ignore");
console.log(
  "sqlite-utils insert dev.db invitation ./invitations.json --nl --ignore",
);
