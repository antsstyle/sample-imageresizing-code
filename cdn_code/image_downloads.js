var validSuffixes = [".jpg", ".png", ".jpeg", ".gif", ".tif", ".tiff"];

function handler(event) {
    var queryString = event.request.querystring.dl;
    var uri = event.request.uri;
    var lastDot = uri.lastIndexOf("."); 
    var validSuffix = false;
    if (lastDot !== -1) {
        var uriSuffix = uri.substring(lastDot).toLowerCase();
        validSuffix = validSuffixes.includes(uriSuffix);
    }
    if (queryString != null && queryString.value == "1" && validSuffix) {
        var response = event.response;
        response.headers["content-disposition"] = {
           value: "attachment"
        };
        return response;
    }
    return event.response;
}