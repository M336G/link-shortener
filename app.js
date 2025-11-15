import { isURL, isFQDN } from "validator";

import { checkToken, generateRandomString, getClientIP } from "./utils/functions.js";
import { Database } from "./utils/database.js";
import { RegexCheck } from "./utils/security.js";
import { Headers } from "./utils/utilities.js";

const TOKEN = process.env.TOKEN || null;
if (!TOKEN) console.warn("No TOKEN environment variable set, some endpoints may have been disabled!")

let BASE_URL = process.env.BASE_URL || "http://localhost:3478/";
if (!BASE_URL.endsWith("/")) BASE_URL += "/";

if (!BASE_URL) console.warn("No BASE_URL environment variable set, defaulting to http://localhost:3478/");

const server = Bun.serve({
    port: Number(process.env.PORT) || 3478,
    development: process.argv.includes("--dev") || false,

    routes: {
        // Submit a new URL to be shortened
        "/": {
            OPTIONS: () => {
                return new Response(null, { status: 204, headers: Headers.redirects });
            },
            GET: (req) => {
                if (!TOKEN) return new Response("This endpoint is disabled!", { status: 403, headers: { ...Headers.redirects, "Access-Control-Allow-Headers": "Authorization" } });
                if (!checkToken(req.headers.get("Authorization"))) return new Response("Invalid token!", { status: 401, headers: { ...Headers.redirects, "Access-Control-Allow-Headers": "Authorization" } });
                
                return Response.json(Database.getAllRedirects(), { headers: Headers.redirects });
            },
            POST: async (req) => {
                const url = (await req.formData()).get("link").trim();

                // Decode the URL if needed
                if (url) {
                    try {
                        url = decodeURIComponent(url);
                    } catch (error) {
                        return new Response("Malformed URL!", { status: 400, headers: Headers.redirects });
                    }
                }

                // Check if an URL has been submitted
                if (!url)
                    return new Response("No URL submitted!", { status: 400, headers: Headers.redirects });

                // ALso check if the URL is actually an URL
                if (!isURL(url))
                    return new Response("Not a valid URL!", { status: 400, headers: Headers.redirects });

                const domain = (new URL(url)).hostname.replace("www.", "");

                // Make sure that the domain is not blacklisted
                if (Database.checkIfDomainIsBlacklisted(domain))
                    return new Response("This domain is blacklisted!", { status: 409, headers: Headers.redirects });

                const redirect = Database.getRedirectFromURL(url);

                if (redirect) { // If the URL already exists, return the existing one
                    if (redirect.enabled) // If the URL exists and is enabled, return it
                        return new Response(BASE_URL + redirect.id, { headers: Headers.redirects });
                    if (!redirect.enabled) // If the URL exists but is disabled, show an error
                        return new Response("This URL is blacklisted!", { status: 403, headers: Headers.redirects });
                } else { // If it doesn't exist and is not disabled, then create a new redirect
                    let id = null;
                    while (!id || Database.getRedirectFromID(id) || Database.checkIfIDIsBlacklisted(id))
                        id = generateRandomString();

                    const ip = getClientIP(req) ?? "unknown";

                    console.info(`Created a new redirect: ${id} -> ${url} (from ${ip})`);

                    Database.addRedirect(id, url, ip);
                    return new Response(BASE_URL + id, { headers: Headers.redirects });
                }
            }
        },

        // List different types related to blacklists
        "/blacklist/:type": {
            OPTIONS: () => {
                return new Response(null, { status: 204, headers: Headers.blacklist });
            },
            // Get all enabled/disabled redirects, all blacklisted domains or all blacklisted words
            GET: (req) => {
                if (!TOKEN) return new Response("This endpoint is disabled!", { status: 403, headers: Headers.blacklist });
                if (!checkToken(req.headers.get("Authorization"))) return new Response("Invalid token!", { status: 401, headers: Headers.blacklist });

                const type = req.params.type?.trim().toLowerCase();

                // Check if an URL has been submitted
                if (!type)
                    return new Response("No type supplied!", { status: 400, headers: Headers.blacklist });

                switch (type) {
                    case "enabled":
                        return Response.json(Database.getAllEnabledRedirects(), { headers: Headers.blacklist });
                    case "disabled":
                        return Response.json(Database.getAllDisabledRedirects(), { headers: Headers.blacklist });
                    case "domains":
                        return Response.json(Database.getAllBlacklistedDomains(), { headers: Headers.blacklist });
                    case "words":
                        return Response.json(Database.getAllBlacklistedWords(), { headers: Headers.blacklist });
                    default:
                        return new Response("Not a valid type!", { status: 400, headers: Headers.blacklist });
                }
            },
            POST: async (req) => {
                if (!TOKEN) return new Response("This endpoint is disabled!", { status: 403, headers: Headers.blacklist });
                if (!checkToken(req.headers.get("Authorization"))) return new Response("Invalid token!", { status: 401, headers: Headers.blacklist });

                const type = req.params.type?.trim().toLowerCase();

                // Check if a type has been submitted
                if (!type)
                    return new Response("No type supplied!", { status: 400, headers: Headers.blacklist });

                let value = (await req.text())?.trim();

                // Check if a value has been submitted
                if (!value)
                    return new Response("No value submitted!", { status: 400, headers: Headers.blacklist });

                switch (type) {
                    case "toggle":
                        if (!RegexCheck.isValidID(value))
                            return new Response("Not a valid ID!", { status: 400, headers: Headers.blacklist });

                        const redirect = Database.getRedirectFromID(value);
                        if (!redirect)
                            return new Response("This ID does not exist!", { status: 400, headers: Headers.blacklist });

                        if (redirect.enabled) {
                            Database.disableRedirect(value);
                            console.info(`Disabled a redirect: ${redirect.id} -> ${redirect.url} (from ${getClientIP(req) ?? "unknown"})`);

                            return new Response("Redirect disabled successfully!", { status: 200, headers: Headers.blacklist });
                        } else {
                            Database.enableRedirect(value);
                            console.info(`Enabled a redirect: ${redirect.id} -> ${redirect.url} (from ${getClientIP(req) ?? "unknown"})`);

                            return new Response("Redirect enabled successfully!", { status: 200, headers: Headers.blacklist });
                        }
                    case "domains":
                        value = value.replace("www.", "");

                        if (!isFQDN(value))
                            return new Response("Not a valid domain!", { status: 400, headers: Headers.blacklist });

                        if (Database.checkIfDomainIsBlacklisted(value)) {
                            Database.removeBlacklistedDomain(value);
                            console.info(`Removed a domain from the blacklist: ${value} (from ${getClientIP(req) ?? "unknown"})`);

                            return new Response("Domain removed from the blacklist successfully!", { status: 200, headers: Headers.blacklist });
                        } else {
                            Database.addBlacklistedDomain(value);
                            console.info(`Added a domain to the blacklist: ${value} (from ${getClientIP(req) ?? "unknown"})`);

                            return new Response("Domain added to the blacklist successfully!", { status: 200, headers: Headers.blacklist });
                        }
                    case "words":
                        if (Database.checkIfIDIsBlacklisted(value)) {
                            Database.removeBlacklistedWord(value);
                            console.info(`Removed a word from the blacklist: ${value} (from ${getClientIP(req) ?? "unknown"})`);

                            return new Response("Word removed from the blacklist successfully!", { status: 200, headers: Headers.blacklist });
                        } else {
                            Database.addBlacklistedWord(value);
                            console.info(`Added a word to the blacklist: ${value} (from ${getClientIP(req) ?? "unknown"})`);
                            
                            return new Response("Word added to the blacklist successfully!", { status: 200, headers: Headers.blacklist });
                        }
                    default:
                        return new Response("Not a valid type!", { status: 400, headers: Headers.blacklist });
                }
            }
        },

        // All the redirects stuff
        "/:id": {
            OPTIONS: () => {
                return new Response(null, { status: 204, headers: Headers.redirects });
            },
            GET: (req) => {
                const id = req.params.id?.trim();

                // Make sure an ID is submitted
                if (!id)
                    return new Response("No ID provided!", { status: 400, headers: Headers.redirects });

                // Make sure the ID is valid
                if (!RegexCheck.isValidID(id))
                    return new Response("Not a valid ID!", { status: 400, headers: Headers.redirects });

                const redirect = Database.getRedirectFromID(id);

                if (redirect) { // If the redirect exists, run checks before returning
                    if (!redirect.enabled) { // If the ID exists but is disabled
                        return new Response("This redirect has been disabled!", { status: 403, headers: Headers.redirects });
                    } else if (Database.checkIfDomainIsBlacklisted((new URL(redirect.url)).hostname.replace("www.", ""))) { // If the domain is blacklisted
                        return new Response("This redirect's domain is blacklisted!", { status: 403, headers: Headers.redirects });
                    } else { // If all checks pass, then return the URL
                        Database.increaseAccessCount(redirect.id);
                        return Response.redirect(redirect.url);
                    }
                } else { // If the ID doesn't exist
                    return new Response("This ID does not exist!", { status: 404, headers: Headers.redirects });
                }
            },
            DELETE: (req) => {
                if (!TOKEN) return new Response("This endpoint is disabled!", { status: 403, headers: { ...Headers.redirects, "Access-Control-Allow-Headers": "Authorization" } });
                if (!checkToken(req.headers.get("Authorization"))) return new Response("Invalid token!", { status: 401, headers: { ...Headers.redirects, "Access-Control-Allow-Headers": "Authorization" } });

                const id = req.params.id?.trim();

                // Make sure an ID is submitted
                if (!id)
                    return new Response("No ID provided!", { status: 400, headers: { ...Headers.redirects, "Access-Control-Allow-Headers": "Authorization" } });

                // Make sure the ID is valid
                if (!RegexCheck.isValidID(id))
                    return new Response("Not a valid ID!", { status: 400, headers: { ...Headers.redirects, "Access-Control-Allow-Headers": "Authorization" } });

                if (redirect) { // If the redirect exists, delete it
                    deleteRedirect(id);
                    console.info(`Deleted a redirect: ${redirect.id} -> ${redirect.url} (from ${getClientIP(req) ?? "unknown"})`);

                    return new Response("Redirect deleted successfully!", { status: 200, headers: { ...Headers.redirects, "Access-Control-Allow-Headers": "Authorization" } });
                } else { // If the ID doesn't exist
                    return new Response("This ID does not exist!", { status: 404, headers: { ...Headers.redirects, "Access-Control-Allow-Headers": "Authorization" } });
                }
            },

            // If the endpoint is not found
            "/*": Response.redirect("https://m336.dev/")
        },
    },
    error(error) {
        console.error(`${error.stack}`);
        return new Response("Internal Server Error", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    }
});
console.info(`Server is now running on ${server.url}`);

process.on("unhandledRejection", async (reason, promise) => {
    console.error(reason);
    await server.stop();
    process.exit(1);
});

process.on("uncaughtException", async (error) => {
    console.error(error);
    await server.stop();
    process.exit(1);
});