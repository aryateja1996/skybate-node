const { SALT_KEY, SALT_INDEX, MERCHANT_ID } = require('./phonepe')
const sha256 = require("sha256");
const uniqid = require("uniqid");


const uniqueTransactionId = function generateMerchantTranscactionId(type) {
    return uniqid() + type;
}
/*
SHA256(base64 encoded payload + “/pg/v1/pay” +
salt key) + ### + salt index
*/
function xVerify(payload, urlEndpoint) {
    let bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
    let base64EncodedPayload = bufferObj.toString("base64");
    let string = base64EncodedPayload + urlEndpoint + SALT_KEY;
    let sha256_val = sha256(string);
    return sha256_val + "###" + SALT_INDEX;


}
function convertToBase64(payload) {
    let bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
    return bufferObj.toString("base64");
}

module.exports = { uniqueTransactionId, xVerify, convertToBase64 };