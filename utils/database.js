import { db } from "./initDatabase.js";

export const Database = {
    getRedirectFromID: (id) => {
        return db.prepare("SELECT id, url, enabled FROM redirects WHERE id = ?").get(id);
    },

    getRedirectFromURL: (url) => {
        return db.prepare("SELECT id, url, enabled FROM redirects WHERE url = ?").get(url);
    },

    checkIfIDIsBlacklisted: (id) => {
        return !!db.prepare("SELECT 1 FROM words_blacklist WHERE INSTR(?, word) > 0 LIMIT 1").get(id);
    },

    checkIfDomainIsBlacklisted: (domain) => {
        return !!db.prepare("SELECT 1 FROM domains_blacklist WHERE domain = ?").get(domain);
    },

    addRedirect: (id, url, ip) => {
        const result = db.prepare("INSERT INTO redirects (id, url, ip, creationTimestamp) VALUES (?, ?, ?, ?)").run(id, url, ip, Date.now());

        if (result.changes <= 0) throw new Error(`Could not add a redirect for "${url}"!`);
    },
    deleteRedirect: (id) => {
        const result = db.prepare("DELETE FROM redirects WHERE id = ?").run(id);

        if (result.changes <= 0) throw new Error(`Could not add delete redirect with ID "${id}"!`);
    },
    increaseAccessCount: (id) => {
        const result = db.prepare("UPDATE redirects SET accessCount = accessCount + 1, lastAccessTimestamp = ? WHERE id = ?").run(Date.now(), id);
        
        if (result.changes <= 0) throw new Error(`Could not increase access count for redirect with ID "${id}"!`);
    },

    getAllRedirects: () => {
        const rows = db.prepare("SELECT id, url, enabled FROM redirects").all();
        return rows.map(row => ({ id: row.id, url: row.url, enabled: row.enabled ? true : false }));
    },
    getAllEnabledRedirects: () => {
        const rows = db.prepare("SELECT id, url FROM redirects WHERE enabled = TRUE").all();
        return rows.map(row => ({ id: row.id, url: row.url }));
    },
    getAllDisabledRedirects: () => {
        const rows = db.prepare("SELECT id, url FROM redirects WHERE enabled = FALSE").all();
        return rows.map(row => ({ id: row.id, url: row.url }));
    },
    getAllBlacklistedDomains: () => {
        const rows = db.prepare("SELECT domain FROM domains_blacklist").all();
        return rows.map(row => row.domain);
    },
    getAllBlacklistedWords: () => {
        const rows = db.prepare("SELECT word FROM words_blacklist").all();
        return rows.map(row => row.word);
    },

    enableRedirect: (id) => {
        const result = db.prepare("UPDATE redirects SET enabled = TRUE WHERE id = ?").run(id);

        if (result.changes <= 0) throw new Error(`Could not enable redirect for "${id}"!`);
    },
    disableRedirect: (id) => {
        const result = db.prepare("UPDATE redirects SET enabled = FALSE WHERE id = ?").run(id);

        if (result.changes <= 0) throw new Error(`Could not disable redirect for "${id}"!`);
    },
    addBlacklistedDomain: (domain) => {
        const result = db.prepare("INSERT INTO domains_blacklist (domain, blacklistedTimestamp) VALUES (?, ?)").run(domain, Date.now());

        if (result.changes <= 0) throw new Error(`Could not add "${domain}" to the domain blacklist!`);
    },
    removeBlacklistedDomain: (domain) => {
        const result = db.prepare("DELETE FROM domains_blacklist WHERE domain = ?").run(domain);

        if (result.changes <= 0) throw new Error(`Could not remove "${domain}" from the domain blacklist!`);
    },
    addBlacklistedWord: (word) => {
        const result = db.prepare("INSERT INTO words_blacklist (word, blacklistedTimestamp) VALUES (?, ?)").run(word, Date.now());

        if (result.changes <= 0) throw new Error(`Could not add "${word}" to the word blacklist!`);
    },
    removeBlacklistedWord: (word) => {
        const result = db.prepare("DELETE FROM words_blacklist WHERE word = ?").run(word);

        if (result.changes <= 0) throw new Error(`Could not remove "${word}" from the word blacklist!`);
    }
};