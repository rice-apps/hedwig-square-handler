var SquareConnect = require("square-connect");

var apiInstance = new SquareConnect.OAuthApi();

addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

/**
 * Attempts to send body of post request to Square's Obtain Token endpoint
 * @param {Request} request represents request sent by Hedwig Square Plugin client
 */
async function handleRequest(request) {
    let response;
    if (request.method === "POST") {
        const { accessCode } = await request.json();
        const body = new SquareConnect.ObtainTokenRequest();

        const squareResponse = await apiInstance.obtainToken({
            ...body,
            grant_type: "authorization_code",
            code: accessCode,
        });

        if (squareResponse) {
            response = new Response("success", { status: 200 });
        } else {
            response = new Response("failure", { status: 404 });
        }
    } else {
        response = new Response("Expected POST", { status: 405 });
    }
    return response;
}
