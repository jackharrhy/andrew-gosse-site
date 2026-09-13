import { openDatabase } from "../app/data/database.ts";
const { sqlite } = await openDatabase();
sqlite.close();
console.log("TeaCMS migrations applied.");
