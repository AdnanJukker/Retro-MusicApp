/**
 * Home has no /trending or /recommendations endpoint to call — these are
 * canned `/search` queries used to populate a "real" section on Home
 * instead of inventing a fake trending endpoint. Centralized so it's easy
 * to see/change what Home actually asks the API for.
 */
export const DISCOVERY_QUERIES = ['Bollywood Hits', 'Arijit Singh', '90s Hindi', 'Retro Hindi', 'Romantic Hits'];

/** Query used to seed the Home "Trending Records" section. */
export const HOME_DISCOVERY_QUERY = DISCOVERY_QUERIES[0];
