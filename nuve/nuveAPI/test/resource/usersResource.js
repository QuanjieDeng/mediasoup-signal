/* global require, describe, it, beforeEach, afterEach */


const mocks = require('../utils');
// eslint-disable-next-line import/no-extraneous-dependencies
const request = require('supertest');
// eslint-disable-next-line import/no-extraneous-dependencies
const express = require('express');
// eslint-disable-next-line import/no-extraneous-dependencies
const sinon = require('sinon');
// eslint-disable-next-line import/no-extraneous-dependencies
const bodyParser = require('body-parser');

const kArbitraryRoom = { _id: '1', name: '', options: { p2p: true, data: '' } };
const kArbitraryService = { _id: '1', rooms: [kArbitraryRoom] };
const kArbitraryUser = { name: '1' };

describe('Users Resource', () => {
  let app;
  let usersResource;
  let serviceRegistryMock;
  let nuveAuthenticatorMock;
  let setServiceStub;
  let cloudHandlerMock;

  beforeEach(() => {
    mocks.start(mocks.licodeConfig);
    cloudHandlerMock = mocks.start(mocks.cloudHandler);
    serviceRegistryMock = mocks.start(mocks.serviceRegistry);
    nuveAuthenticatorMock = mocks.start(mocks.nuveAuthenticator);
    setServiceStub = sinon.stub();
    // eslint-disable-next-line global-require
    usersResource = require('../../resource/usersResource');

    app = express();
    app.use(bodyParser.json());
    app.all('*', (req, res, next) => {
      req.service = setServiceStub();
      next();
    });
    app.get('/rooms/:room/users', usersResource.getList);
  });

  afterEach(() => {
    mocks.stop(mocks.licodeConfig);
    mocks.stop(cloudHandlerMock);
    mocks.stop(serviceRegistryMock);
    mocks.stop(nuveAuthenticatorMock);
    mocks.deleteRequireCache();
    mocks.reset();
  });

  describe('Get List', () => {
    it('should fail if service is not present', (done) => {
      serviceRegistryMock.getRoomForService.callsArgWith(2, kArbitraryRoom);
      request(app)
        .get('/rooms/1/users')
        .expect(404, 'Service not found')
        .end((err) => {
          if (err) throw err;
          done();
        });
    });

    it('should fail if room is not found', (done) => {
      serviceRegistryMock.getRoomForService.callsArgWith(2, undefined);
      setServiceStub.returns(kArbitraryService);
      request(app)
        .get('/rooms/1/users')
        .expect(404, 'Room does not exist')
        .end((err) => {
          if (err) throw err;
          done();
        });
    });

    it('should fail if CloudHandler does not respond', (done) => {
      serviceRegistryMock.getRoomForService.callsArgWith(2, kArbitraryRoom);
      setServiceStub.returns(kArbitraryService);
      cloudHandlerMock.getUsersInRoom.callsArgWith(1, 'timeout');
      request(app)
        .get('/rooms/1/users')
        .expect(503, 'Erizo Controller managing this room does not respond')
        .end((err) => {
          if (err) throw err;
          done();
        });
    });

    it('should succeed if user exists', (done) => {
      serviceRegistryMock.getRoomForService.callsArgWith(2, kArbitraryRoom);
      setServiceStub.returns(kArbitraryService);
      cloudHandlerMock.getUsersInRoom.callsArgWith(1, [kArbitraryUser]);
      request(app)
        .get('/rooms/1/users')
        .expect(200, JSON.stringify([kArbitraryUser]))
        .end((err) => {
          if (err) throw err;
          done();
        });
    });
  });
});
