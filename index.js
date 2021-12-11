const Web3 = require("web3");
const web3 = new Web3("https://rinkeby.arbitrum.io/rpc");
const oracleContractJson = require("./abis/Oracle.json");
const marketRouterContractJson = require("./abis/MarketRouter.json");
const axios = require("axios");
const axiosBaseInstance = axios.create({
	baseURL: "http://localhost:8080",
	timeout: 1000,
	headers: { "Content-Type": "application/json" },
});
const crypto = require("crypto");

const coldPvKey = "";
const hotPvKey = "";
const keySignature = "";

const coldAccount = web3.eth.accounts.privateKeyToAccount(coldPvKey);
const hotAccount = web3.eth.accounts.privateKeyToAccount(hotPvKey);

// setup oracles and contracts
const addresses = {
	OracleFactory: "0xC6d56EBb4264efB8e1aBc9Ca3F1970165F3F8479",
	MarketRouter: "0x3c7717EAfaC324919df2d91CceFEea7817B851D2",
	WETH: "0xebbc3452cc911591e4f18f3b36727df45d6bd1f9",
};
const oracleAddresses = {
	cars: "0xe8a1c53105fe8d681e7686d462f53e21e0c8c0d6",
};
function oracleContractInstance(_oracleAddress) {
	return new web3.eth.Contract(oracleContractJson, _oracleAddress);
}
function marketRouterContractInstance(
	_marketRouterAddress = addresses.MarketRouter
) {
	return new web3.eth.Contract(
		marketRouterContractJson,
		_marketRouterAddress
	);
}

// helper functions
function keccak256(msg) {
	return web3.utils.keccak256(msg);
}

async function sendTx(tx) {
	let options = {
		to: tx._parent._address,
		data: tx.encodeABI(),
		gas: await tx.estimateGas({ from: coldAccount.address }),
		gasPrice: await tx._ethAccounts._ethereumCall.getGasPrice(),
	};
	const signedTx = await coldAccount.signTransaction(options);
	const txReceipt = await web3.eth.sendSignedTransaction(
		signedTx.rawTransaction
	);
	return txReceipt;
}

function parseDecToEther(decStr) {
	return web3.utils.toWei(decStr);
}

function getRequestSignatures(msg) {
	const { signature } = hotAccount.sign(msg);
	return {
		keySignature,
		msgSignature: signature,
	};
}

async function createFundBetOnMarket(
	identifier,
	oracleAddress,
	fundAmountDec,
	betAmountDec
) {
	const tx = marketRouterContractInstance().methods.createFundBetOnMarket(
		keccak256(identifier),
		oracleAddress,
		parseDecToEther(fundAmountDec),
		parseDecToEther(betAmountDec),
		"1"
	);
	const receipt = await sendTx(tx);
	return receipt;
}

async function createNewPost(
	imageUrl,
	oracleAddress,
	fundAmountDec,
	betAmountDec
) {
	await createFundBetOnMarket(
		imageUrl,
		oracleAddress,
		fundAmountDec,
		betAmountDec
	);

	// add it to the backend
	const msg = {
		oracleAddress,
		eventIdentifierStr: imageUrl,
	};
	const signatures = getRequestSignatures(JSON.stringify(msg));
	const { data } = await axiosBaseInstance.request({
		url: "/post/new",
		method: "POST",
		data: {
			signatures,
			msg,
		},
	});
	console.log(data);
}

async function createMultiplePosts(count) {
	for (let i = 0; i < count; i++) {
		const id = crypto.randomBytes(8).toString("hex");
		const imageUrl = `https://i5.walmartimages.com/asr/aac0f71f-ffa1-4951-90a1-b45c682d88b6_1.dc965775e1cbd4790a04fab4812bf555.jpeg?odnHeight=612&odnWidth=612&odnBg=FFFFFF?id=${id}`;
		await createNewPost(imageUrl, oracleAddresses.cars, "0.0001", "0.0001");
	}
}

(async function () {
	try {
		createMultiplePosts(2);
	} catch (e) {
		console.log("error thrown");
	}
})();