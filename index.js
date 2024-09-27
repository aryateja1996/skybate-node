const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");
const { MERCHANT_ID, PHONE_PE_HOST_URL, SALT_INDEX, SALT_KEY, APP_URL } = require("./consts/phonepe");
const { uniqueTransactionId, xVerify, convertToBase64 } = require('./consts/phonepe_functions')
const app = express();
const fs = require('fs')
const { db } = require('./firebase/index')
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
// setting up middleware
app.use(cors());
app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: false,
    })
);
const logStream = fs.createWriteStream('logs/output.log', { flags: 'a' }); // 'a' for append mode

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);
    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        console.log('Forking a new worker...');
        cluster.fork();
    });
} else {
    app.get('/', function (req, res) {
        logStream.write("Hello World working")
        res.send("working")
    })
    //"redirectUrl": `${APP_URL}/redirect?key=${merchantTransactionId}`,
    app.post('/pay/:paymentFor', function (req, res) {
        let endpoint = '/pg/v1/pay'
        const merchantTransactionId = uniqueTransactionId(req.params.paymentFor);
        const normalPayload = {
            "merchantId": MERCHANT_ID,
            "merchantTransactionId": merchantTransactionId,
            "merchantUserId": req.body.userId,
            "amount": req.body.amount * 100,
            "redirectUrl": `https://api.skybate.in/paymentverify/${merchantTransactionId}`,
            "redirectMode": "REDIRECT",
            "mobileNumber": `${req.body.phoneNumber}`,
            "paymentInstrument": {
                "type": "PAY_PAGE"
            }
        }
        var requestBody = req.body;
        console.log(requestBody);

        db.collection(`${req.params.paymentFor}`).doc(merchantTransactionId).create({
            "name": requestBody.name,
            "phone": requestBody.phoneNumber,
            "email": requestBody.email,
            "experience": requestBody.experience,
            "interests": requestBody.interests,
            "payment_status": "PENDING",
        })

        logStream.write(`${normalPayload} \n Normal Payload is above`)
        const options = {
            method: 'post',
            url: `${PHONE_PE_HOST_URL + endpoint}`,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': xVerify(normalPayload, endpoint)
            },
            data: {
                request: convertToBase64(normalPayload)
            }
        };
        axios
            .request(options)
            .then(function (response) {
                console.log(normalPayload);

                //   res.redirect(response.data.data.instrumentResponse.redirectInfo.url);
                res.send({ "redirectUrl": response.data.data.instrumentResponse.redirectInfo.url })
            })
            .catch(function (error) {
                console.error(error.response.data);
                res.send(error.response.data)
            });
    })

    app.get("/paymentverify/:merchantTransactionId", async function (req, res) {

        logStream.write('Came Here But Galanthu')
        const { merchantTransactionId } = req.params;
        // check the status of the payment using merchantTransactionId
        let endpoint = "/pg/v1/status/";
        if (merchantTransactionId) {
            let statusUrl =
                `${PHONE_PE_HOST_URL + endpoint + MERCHANT_ID}/` +
                merchantTransactionId;

            // generate X-VERIFY
            let string =
                `${endpoint}${MERCHANT_ID}/` + merchantTransactionId + SALT_KEY;
            let sha256_val = sha256(string);
            let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

            axios
                .get(statusUrl, {
                    headers: {
                        "Content-Type": "application/json",
                        "X-VERIFY": xVerifyChecksum,
                        "X-MERCHANT-ID": merchantTransactionId,
                        accept: "application/json",
                    },
                })
                .then(function (response) {
                    console.log("response->", response.data);
                    if (response.data && response.data.code === "PAYMENT_SUCCESS") {
                        // redirect to FE payment success status page
                        res.redirect(`${APP_URL}sucess-payment`)
                        logStream.write(`${APP_URL} appurls --- sucess-payment`)
                        // res.send(response.data);
                    } else {
                        // redirect to FE payment failure / pending status page
                        res.redirect(`${APP_URL}fail-payment`)
                    }
                })
                .catch(function (error) {
                    // redirect to FE payment failure / pending status page
                    logStream.write(`Error :: ${error}`)
                    res.send(error);
                });
        } else {
            logStream.write("Sorry!! ERROR no merchantTransactionId")
            res.send("Sorry!! Error");
        }
    });



    const port = 3010;
    app.listen(port, () => {
        console.log(`PhonePe application listening on port ${port}`);
    });
}