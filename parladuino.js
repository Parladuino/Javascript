(function (parladuino) {

    // lista de acciones disponibles
    parladuino.actions = {
        NONE: 0,
        REPLY_TO_ID: 1,
        REPLY_TO_GROUP: 2,
        WRITE_TO_ID_AND_REPLY_TO_ID: 3,
        WRITE_TO_ID_AND_REPLY_TO_GROUP: 4,
        WRITE_TO_GROUP_AND_REPLY_TO_ID: 5,
        WRITE_TO_GROUP_AND_REPLY_TO_GROUP: 6,
        WRITE_TO_ID: 7,
        WRITE_TO_GROUP: 8,
        RESPOND_TO_ID: 9,
        RESPOND_TO_GROUP: 10
    };

    /////////////////////            PINES 
    // constructor 
    parladuino.genericPin = function (pGenPin) {
        this.p = 0;
        this.n = "";
        this.v = 0;
        if (pGenPin) {
            for (var prop in pGenPin) {
                if (typeof this[prop] != "object") {
                    this[prop] = pGenPin[prop]
                }
            }
        }
    }

    // get y set
    parladuino.genericPin.prototype = {
        get name() { return this.n },
        set name(pVal) { this.n = pVal },
        get pin() { return this.p },
        set pin(pVal) { this.p = pVal },
        get value() { return this.v },
        set value(pVal) { this.v = Number(pVal) }
    }

    //////////////////////        MENSAJES
    // constructor
    parladuino.message = function (pMsg) {
        this.fi = "";
        this.fg = "";
        this.ti = "";
        this.tg = "";
        this.ac = 0;
        this.an = new Array();
        this.dg = new Array();

        if (pMsg) {
            for (var prop in pMsg) {
                if (typeof this[prop] != "object") {
                    this[prop] = pMsg[prop]
                } else {
                    for (var i = 0; i < pMsg[prop].length; i++) {
                        this[prop][i] = new parladuino.genericPin(pMsg[prop][i]);
                    }

                }
            }
        }

    }
    // get y set
    parladuino.message.prototype = {
        get fromID() { return this.fi },
        set fromID(pVal) { this.fi = pVal },

        get fromGroup() { return this.fg },
        set fromGroup(pVal) { this.fg = pVal },

        get toID() { return this.ti },
        set toID(pVal) { this.ti = pVal },

        get toGroup() { return this.tg },
        set toGroup(pVal) { this.tg = pVal },

        get action() { return this.ac },
        set action(pVal) { this.ac = pVal },

        get analogs() { return this.an },
        set analogs(pVal) { this.ans = pVal },

        get digitals() { return this.dg },
        set digitals(pVal) { this.dg = pVal }

    }

    ///  Argumento para eventos de conexión
    parladuino.connectionEventArgs = function (evt, pMessage) {
        this.event = evt;
        this.message = pMessage;
    }

    ///  Argumento para eventos de lectura o escritura de pines
    parladuino.deviceEventArgs = function (pPin) {
        this.pin = pPin;
    }

    parladuino.connection = function (pConnection) {
        this.publicKey="";
        this.privateKey= "";
        this.group= "";
        this.ID= "";
        this.onOpen= function () { };
        this.onMessage= function () { };
        this.onConnectionMessage= function () { };
        this.onError= function () { };
        this.onClose= function () { };
        this.onCredentialError= function () { };
        this.autoconnect = true

        if (pConnection) {
            for (var prop in pConnection) {
                this[prop] = pConnection[prop]
            }
        }
    }

    this.onDigitalWrite = function () { };
    this.onAnalogWrite = function () { };
    this.onDigitalRead = function () { };
    this.onAnalogRead = function () { };
    
    //    Dispositivo virtual
    parladuino.device = function () {

        // objeto conexion
        this.connection = null;

        // objeto websocket
        this.ws = null;

        // envia un mensaje
        this.send = function (pMessage) {
            if (this.ws != null) {
                pMessage.fromID = this.connection.ID;
                pMessage.fromGroup = this.connection.group;
                this.ws.send(JSON.stringify(pMessage))
            }
        }

        // cierra la conexion
        this.close = function () {
            if (this.ws != null) {
                this.ws.close();
            }
        }

        // conecta con parladuino
        this.connect = function (pConnection) {

            // selecciona la conexion
            if (pConnection) {this.connection = pConnection}

            // guarda la conexion 
            var that = this;

            $.ajax({

                url: "http://www.mind-tech.com.ar//ParlaSocket/api/Key",

                // si la conexion es exitosa y trajo las credenciales de api de Parladuino
                success: function (creadential) {

                    // encripta la clave privada 
                    var crypto = CryptoJS.SHA1(creadential + that.connection.privateKey)

                    // conecta con web socket de Parladuino
                    var ws = new WebSocket("ws://mind-tech.com.ar//ParlaSocket/api/Ws?user=" + that.connection.publicKey + "&pass=" + crypto + "&group=" + that.connection.group + "&ID=" + that.connection.ID);

                    // al abrir la conexion del web soket
                    ws.onopen = function (evt) { that.connection.onOpen(that, new parladuino.connectionEventArgs(evt, null)) };

                    // cuando llega un mensaje a traves del web socket
                    ws.onmessage = function (evt) {
                        var stringMessage = evt.data.replace(/[\n\r\0]/g, '');
                        var msg = JSON.parse(stringMessage);
                        if (msg) {

                            // dos tipos de mensaje
                            if (msg.user) {
                                // mensaje de conexion
                                that.connection.onConnectionMessage(that, new parladuino.connectionEventArgs(evt, msg));
                            }
                            else {
                                // mensaje de datos
                                that.connection.onMessage(that, new parladuino.connectionEventArgs(evt, new parladuino.message(msg)));
                            }
                        }
                    };

                    // cuando hay un error web socket
                    ws.onerror = function (evt) { that.connection.onError(that, new parladuino.connectionEventArgs(evt, null)) }

                    // al cerrar conexion del web socket
                    ws.onclose = function (evt) {
                        that.connection.onClose(that, new parladuino.connectionEventArgs(evt, null));

                        // reconecta automaticamente
                        if (that.connection.autoconnect) {
                            that.connect();
                        }
                    }

                    // guardo el web socket
                    that.ws = ws
                },

                // no se pudo conectar con Parladuino para traer las credenciales
                error: function (evt) { that.connection.onCredentialError(that, new parladuino.connectionEventArgs(evt, null)) }

            });
        }


        // aplica el mensaje al device segun la accion
        this.apply = function (pMessage) {
            var i = 0;

            // para pines analogos
            for (var i in pMessage.analogs) {

                // la accion indica un write
                if (pMessage.action > parladuino.actions.REPLY_TO_GROUP && pMessage.action < parladuino.actions.RESPOND_TO_ID) {
                    this.onAnalogWrite(this,new parladuino.deviceEventArgs(pMessage.analogs[i]));
                }
                var readPin = this.onAnalogRead(this, new parladuino.deviceEventArgs(pMessage.analogs[i]));
                pMessage.analogs[i].value = readPin.value;
                pMessage.analogs[i].name = readPin.name;
                i++;
            }

            i = 0;

            // para pines dgigitales
            for (var i in pMessage.digitals) {

                // la accion indica un write
                if (pMessage.action > parladuino.actions.REPLY_TO_GROUP && pMessage.action < parladuino.actions.RESPOND_TO_ID) {
                    this.onDigitalWrite(this, new parladuino.deviceEventArgs(pMessage.digitals[i]));
                }

                var readPin = this.onDigitalRead(this, new parladuino.deviceEventArgs(pMessage.digitals[i]));
                pMessage.digitals[i].value = readPin.value;
                pMessage.digitals[i].name = readPin.name;
                i++;
            }
        }

        // responde el mensaje segun la accion al remitente
        this.reply = function (pMessage) {

            // la accion implica una respuesta
            if (pMessage.action > parladuino.actions.NONE && pMessage.action < parladuino.actions.WRITE_TO_ID) {

                // toma el ID del remitente
                pMessage.toID = pMessage.fromID;
                pMessage.toGroup = ""
                pMessage.fromID = this.connection.ID;

                // la accion implica una repuesta al grupo
                if (pMessage.action == parladuino.actions.REPLY_TO_GROUP || pMessage.action == parladuino.actions.WRITE_TO_ID_AND_REPLY_TO_GROUP || pMessage.action == parladuino.actions.WRITE_TO_GROUP_AND_REPLY_TO_GROUP) {

                    // toma el Grupo del remitente
                    pMessage.toGroup = pMessage.fromGroup
                    pMessage.action = parladuino.actions.RESPOND_TO_GROUP;

                } else {

                    // la accion implica una repuesta al ID
                    pMessage.action = parladuino.actions.RESPOND_TO_ID;
                }

                // envia el mensaje reultante
                this.send(pMessage);

            }
        }

    }

})(window.parladuino = window.parladuino || {})
