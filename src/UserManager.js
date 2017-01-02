'use strict';

const fs = require('fs');

function UserManager(docClient, s3client){
	this.DocClient = docClient;
	this.S3client = s3client;
};

UserManager.prototype.GetUser = function(body, environment, userId, callback) {
	var table = `users.health-verify.${environment}`;
	var lookupUser = body.user || userId;
	var queryPromise = this.DocClient.query({
		TableName: table,
		Limit: 1,
		ScanIndexForward: false,
		KeyConditionExpression: 'UserId = :id',
		ExpressionAttributeValues: {
			':id': lookupUser
		},
		ProjectionExpression: 'UserId, Verifications'
	}).promise().then(result => result.Items[0]);

	if(lookupUser === userId) {
		queryPromise = queryPromise
		.then(user => {
			if(user == null) {
				return this.DocClient.put({
					TableName: table,
					Item: {
						UserId: userId
					}
				}).promise();
			}
			return user;
		})
		.catch(error => {
			if(error.code !== 'ResourceNotFoundException') { return Promise.reject(error); }
			return this.DocClient.put({
				TableName: table,
				Item: {
					UserId: userId
				}
			}).promise();
		});
	}
	else {
		queryPromise = queryPromise
		.then(user => {
			if(!user) {
				return Promise.reject('User does not exist.');
			}
			return {
				UserId: userId,
				Verifications: user.Verifications.filter(v => v.Status === 'Verifiied')
			};
		});
	}
	return queryPromise
	.then(result => {
		return callback({
			statusCode: 200,
			body: result
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: `Unable to retrieve user: ${error.stack || error.toString()}`,
			detail: error
		});
	});
};

UserManager.prototype.SetVerifications = function(body, environment, userId, callback) {
	var verifications = body.verifications;
	var userInfo = body.user;
	var verificationRequestPromise = this.DocClient.put({
		TableName: `verificationRequests.health-verify.${environment}`,
		Item: {
			UserId: userId,
			Time: new Date().getTime(),
			Info: body,
			Status: 'NEW'
		}
	}).promise();

	var userTable = `users.health-verify.${environment}`;
	var userUpdatePromise = this.DocClient.query({
		TableName: userTable,
		Limit: 1,
		ScanIndexForward: false,
		KeyConditionExpression: 'UserId = :id',
		ExpressionAttributeValues: {
			':id': userId
		}
	}).promise().then(result => result.Items[0])
	.then(user => {
		var currentVerifications = user.Verifications || [];
		var currentVerificationsHash = {};
		currentVerifications.map(v => currentVerificationsHash[v.Id] = true);
		var allVerifications = user.Verifications.concat(verifications.filter(v => !currentVerificationsHash[v.Id]));

		return this.DocClient.update({
			TableName: userTable,
			Key: {
				'UserId': userId
			},
			AttributeUpdates: {
				'Verifications': {
					Action: 'PUT',
					Value: allVerifications
				}
			},
			ReturnValues: 'NONE'
		}).promise();
	});

	return Promise.all([verificationRequestPromise, userUpdatePromise])
	.then(result => {
		return callback({
			statusCode: 200,
			body: result
		});
	})
	.catch(error => {
		return callback({
			statusCode: 400,
			error: `Unable to set verifications: ${error.stack || error.toString()}`,
			detail: error
		});
	});
};

module.exports = UserManager;