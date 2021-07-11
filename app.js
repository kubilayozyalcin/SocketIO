const net = require('net');
const { Sequelize } = require('sequelize');
const port = 1720;
const server = net.createServer();
const sequelize = new Sequelize('xTakip', 'lingoon', 'P@55word', {
    dialect: "mssql",
    host: "sql2012.isimtescil.net",
    logging: false,
    dialectOptions: {
        options: {
            encrypt: false,
            validateBulkLoadParameters: true
        }
    },
    pool: {
        max: 5,
        min: 0,
        idle: 10000,
        acquire: 20000
    }
})

const Request = sequelize.define('Request', {
    DeviceID: Sequelize.STRING,
    RequestCode: Sequelize.STRING,
    SendData: Sequelize.INTEGER,
    UserName: Sequelize.STRING,
    Response: Sequelize.STRING
})

const Device = sequelize.define('Device', {
    DeviceStatus: Sequelize.STRING,
    DeviceID: Sequelize.STRING,
})

function dbProcess(sock) {
    if (sock.id > 0) {
        console.log("sockets items: %s", sockets.length);
        console.log("sock id %s", sock.id);

        let ID = sock.id;

        Request.findOne({
            where: {
                DeviceID: ID,
                SendData: false
            },
            order: [
                ['id', 'DESC']
            ]
        }).then((row) => {
            if (row) {
                let response = null;
                let jsData = row.toJSON();
                console.log("Calistirilan komut %s", jsData.RequestCode)
                sock.socket.write(jsData.RequestCode);
                sock.socket.on("data", function (res) {
                    if (res.indexOf("@ID") === 0) {
                        response = res.toString();

                        row.update({
                            Response: response
                        },{
                            where: {
                                id: row.id
                            }
                        }).then((row) => {
                            console.log("Guncelleme islemi basarili. Data: %s", row.toJSON())
                        })
                    }
                })

                row.update({
                    SendData: true
                },{
                    where: {
                        id: row.id
                    }
                }).then((row) => {
                    console.log("Guncelleme islemi basarili. Data: %s", row.toJSON())
                })
            } else {
                //console.log("Yeni komut yok.")
            }
        }).catch( err => console.log(err));
    }
}

server.listen(port, () => {
    console.log(`TCP server listening on ${port}`);
});
let sockets = [];

server.on('connection', (socket) => {
    let clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`new client connected: ${clientAddress}`);
    sockets.push(sockets[clientAddress] = {socket: socket, id: null});
    socket.on('data', (data) => {
        let ClientID;

        if (data.toString().indexOf("@C") === 0) {
            ClientID = data.toString().split(";")[1];
            sockets[clientAddress].id = ClientID;
            console.log("Client id %s", sockets[clientAddress].id)
        }

        if (data.toString().indexOf("@L") === 0) {
            let deviceStatus = data.toString().slice(77, 80),
                deviceID = data.toString().slice(5, 22);
            console.log("Alarm %s", deviceStatus)
            console.log("Device %s", deviceID)

            Device.findOne({
                where: {
                    DeviceID: deviceID,
                }
            }).then((row) => {
                if (row && (deviceStatus == 300 || deviceStatus== 301)) {
                    row.update({
                        DeviceStatus: deviceStatus
                    },{
                        where: {
                            deviceID: row.deviceID
                        }
                    }).then((row) => {
                        console.log("Bariyer durumu güncellendi.")
                    })
                } else {
                    //console.log("Yeni komut yok.")
                }
            }).catch( err => console.log(err));

        }




    });

    setInterval( () => {
         sockets.forEach( async (sock) => {
            await dbProcess(sock);
        });
    }, 1000);

    socket.on('close', (data) => {
        sockets.forEach((sock, index) => {
            if (`${sock.socket.remoteAddress}:${sock.socket.remotePort}` === `${socket.remoteAddress}:${socket.remotePort}`) {
                sockets.splice(index, 1);
                console.log(`remove client list data item: ${clientAddress}`);
            }
        });
        console.log(`connection closed: ${clientAddress}`);
    });

    socket.on('error', (err) => {
        console.log(`Error occurred in ${clientAddress}: ${err.message}`);
    });
});
