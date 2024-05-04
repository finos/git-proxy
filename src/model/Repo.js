// Regex inspector - https://www.debuggex.com/
// eslint-disable-next-line no-useless-escape
const GIT_URL_REGEX = new RegExp("^(https)://(github\.com|gitlab\.com)/([a-zA-Z0-9\-\.]+)/([a-zA-Z0-9\-]+)(\.git)(/)?$");

/** Class representing a Repo. */
class Repo {
    url;
    protocol;
    host;
    project;
    name;

    /**
     * 
     * @param {string} url The url for the repo.
     */
    constructor(url) {
        const parsedUrl = url?.match(GIT_URL_REGEX);
        if (parsedUrl) {
            this.url = url;
            this.protocol = parsedUrl[1];
            this.host = parsedUrl[2];
            this.project = parsedUrl[3];
            this.name = parsedUrl[4] + parsedUrl[5]; // repo name + .git
            return;
        }
        throw new Error(`Invalid repo url: "${url}"`);
    }
}

exports.Repo = Repo;