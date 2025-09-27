CREATE TABLE redirects (
    id VARCHAR(5) NOT NULL UNIQUE,
    accessCount INTEGER DEFAULT 0 NOT NULL,
    url TEXT NOT NULL,
    ip VARCHAR NOT NULL,
    creationTimestamp INTEGER NOT NULL,
    lastAccessTimestamp INTEGER DEFAULT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    PRIMARY KEY(id)
);

CREATE TABLE domains_blacklist (
    domain VARCHAR NOT NULL UNIQUE,
    blacklistedTimestamp INTEGER NOT NULL,
    PRIMARY KEY(domain)
);

CREATE TABLE words_blacklist (
    word VARCHAR NOT NULL UNIQUE,
    blacklistedTimestamp INTEGER NOT NULL,
    PRIMARY KEY(word)
);