const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const sha256 = require("sha256");
const uniqid = require("uniqid");
const { MERCHANT_ID, PHONE_PE_HOST_URL, SALT_INDEX, SALT_KEY, APP_URL, NODE_URL } = require("./consts/phonepe");
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

if (cluster.isMaster && false) {
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
    app.post('/saveDetails/:saveFor',(req,res)=>{
        var requestBody = req.body;
        
        db.collection(`${req.params.saveFor}`)
        .doc()
        .create({ 
          "details": requestBody, 
          "paymentDetails": 'NOTDONE' 
        })
        .then(() => {
          res.status(200).send({ "status": 200 });
        })
        .catch((error) => {
          console.error("Error adding document: ", error);
          res.status(500).send({ "status": 500, "error": error.message });
        });
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
            "redirectUrl": `${ NODE_URL + merchantTransactionId}`,
            "redirectMode": "REDIRECT",
            "mobileNumber": `${req.body.phone}`,
            "paymentInstrument": {
                "type": "PAY_PAGE"
            }
        }

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

    app.get("/paymentverify/:merchantTransactionId",  function (req, res) {

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
                        "X-MERCHANT-ID": MERCHANT_ID,
                        accept: "application/json",
                    },
                })
                .then( function (response) {
                    console.log("response->", response.data);
                    console.log(response.data.code)
                    if (response.data && response.data.code === "PAYMENT_SUCCESS") {
                    //     console.log("inside the if block")
                    //     const paymentData = response.data;  // The whole object
                    //     // const encodedData = base64url.encode(JSON.stringify(paymentData)); // Encode the object
                    // const encodedData = base64url.encode(`${merchantTransactionId}`)
                    // console.log(paymentData); console.log(encodedData);
                        // Redirect to success page with encoded data
                        res.redirect(`${APP_URL}sucess-payment?data=${merchantTransactionId}`);
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

    app.get("/paymentverifyafter/:merchantTransactionId",  function (req, res) {

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
                        "X-MERCHANT-ID": MERCHANT_ID,
                        accept: "application/json",
                    },
                })
                .then( function (response) {
                    console.log("response->", response.data);
                    console.log(response.data.code)
                    res.send(response.data)
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