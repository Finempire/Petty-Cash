const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(':memory:');
db.exec('CREATE TABLE t(id INTEGER)');
db.prepare('INSERT INTO t VALUES(1)').run();
console.log('node:sqlite OK:', db.prepare('SELECT * FROM t').all());
