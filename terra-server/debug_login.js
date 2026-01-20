const db = require('./database');

try {
    console.log("Checking 'character_cyborg' table info:");
    const info = db.prepare("PRAGMA table_info(character_cyborg)").all();
    console.table(info);

    console.log("\nChecking 'user_resources' table info:");
    const resInfo = db.prepare("PRAGMA table_info(user_resources)").all();
    console.table(resInfo);

    console.log("\nTrying to fetch user 1 details manually:");
    const user = db.prepare('SELECT * FROM users WHERE id = 1').get();
    console.log("User:", user);

    if (user) {
        const stats = db.prepare('SELECT * FROM character_cyborg WHERE user_id = 1').get();
        console.log("Stats:", stats);

        const resources = db.prepare('SELECT * FROM user_resources WHERE user_id = 1').get();
        console.log("Resources:", resources);
    }

} catch (e) {
    console.error("Error:", e);
}
