(function (parladuino) {


    parladuino.actions = {
        NONE:0,
        REPLY_TO_ID:1,
        REPLY_TO_GROUP:2,
        WRITE_TO_ID_AND_REPLY_TO_ID:3,
        WRITE_TO_ID_AND_REPLY_TO_GROUP:4,
        WRITE_TO_GROUP_AND_REPLY_TO_ID:5,
        WRITE_TO_GROUP_AND_REPLY_TO_GROUP:6,
        WRITE_TO_ID:7,
        WRITE_TO_GROUP:8,
        RESPOND_TO_ID:9,
        RESPOND_TO_GROUP:10
    };


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

    parladuino.genericPin.prototype = {
        get name() { return this.n },
        set name(pVal) { this.n = pVal },
        get pin() { return this.p },
        set pin(pVal) { this.p = pVal },
        get value() { return this.v },
        set value(pVal) {
            this.v = Number(pVal);
        }
    }

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

    parladuino.eventArgs = function (evt,pMessage) {
        this.event = evt;
        this.message = pMessage;
    }

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

    parladuino.WebSocket = function () {



        this.connection = {
            publicKey: "",
            privateKey: "",
            group: "",
            ID: "",
            onOpen: function () { },
            onMessage: function () { },
            onConnectionMessage: function () { },
            onError: function () { },
            onClose: function () { },
            onCredentialError: function () { },
            onDigitalWrite: function () { },
            onAnalogWrite: function () { },
            onDigitalRead: function () { },
            onAnalogRead: function () { },
            autoconnect: true

        }

        this.ws = null;

        this.send = function (pMessage) {
            if (this.ws != null) {
                this.ws.send(JSON.stringify(pMessage))
            }
        }

        this.close = function () {
            if (this.ws != null) {
                this.ws.close();
            }
        }


        this.connect = function (pConnection) {
            if (pConnection) {
                for (var n in pConnection) {
                    this.connection[n] = pConnection[n];
                }
            }
            var that = this;
            $.ajax({
                url: "http://www.mind-tech.com.ar//ParlaSocket/api/Key",
                success: function (creadential) {
                    var crypto = CryptoJS.SHA1(creadential + that.connection.privateKey)
                    var ws = new WebSocket("ws://mind-tech.com.ar//ParlaSocket/api/Ws?user=" + that.connection.publicKey + "&pass=" + crypto + "&group=" + that.connection.group + "&ID=" + that.connection.ID);
                    ws.onopen = function (evt) { that.connection.onOpen(that, new parladuino.eventArgs(evt,null)) };
                    ws.onmessage = function (evt) {
                        var stringMessage = evt.data.replace(/[\n\r\0]/g, '');
                        var msg = JSON.parse(stringMessage);
                        if (msg) {
                            if (msg.user) {
                                that.connection.onConnectionMessage(that, new parladuino.eventArgs(evt,msg));
                            }
                            else {
                                that.connection.onMessage(that, new parladuino.eventArgs(evt,new parladuino.message(msg)));
                            }
                        }
                    };
                    ws.onerror = function (evt) { that.connection.onError(that, new parladuino.eventArgs(evt, null)) }
                    ws.onclose = function (evt) {
                        that.connection.onClose(that, new parladuino.eventArgs(evt, null));
                        if (that.connection.autoconnect) {
                            that.connect();
                        }
                    }
                    that.ws = ws
                },
                error: function (evt) { that.connection.onCredentialError(that, new parladuino.eventArgs(evt, null)) }
            });
        }


       
        this.apply = function (pMessage) {
            var i = 0;
            
            for (var i in pMessage.analogs) {
                if (pMessage.action > parladuino.actions.REPLY_TO_GROUP && pMessage.action < parladuino.actions.RESPOND_TO_ID) {
                    this.connection.onAnalogWrite(pMessage.analogs[i]);
                }
                var readPin = this.connection.onAnalogRead(pMessage.analogs[i]);
                pMessage.analogs[i].value = readPin.value;
                pMessage.analogs[i].name = readPin.name;
                i++;
            }

            i=0;
            for (var i in pMessage.digitals) {
                if (pMessage.action > parladuino.actions.REPLY_TO_GROUP && pMessage.action < parladuino.actions.RESPOND_TO_ID) {
                    this.connection.onDigitalWrite(pMessage.digitals[i]);
                }
                var readPin = this.connection.onDigitalRead(pMessage.digitals[i]);
                pMessage.digitals[i].value = readPin.value;
                pMessage.digitals[i].name = readPin.name;
                i++;
            }
        }

        this.reply = function (pMessage) {
            if (pMessage.action > parladuino.actions.NONE && pMessage.action < parladuino.actions.WRITE_TO_ID) {

                pMessage.toID = pMessage.fromID;
                pMessage.toGroup = ""
                pMessage.fromID= this.connection.ID;


                // reply to group
                if (pMessage.action == parladuino.actions.REPLY_TO_GROUP || pMessage.action == parladuino.actions.WRITE_TO_ID_AND_REPLY_TO_GROUP || pMessage.action == parladuino.actions.WRITE_TO_GROUP_AND_REPLY_TO_GROUP) {
                    pMessage.toGroup = pMessage.fromGroup
                    pMessage.action = parladuino.actions.RESPOND_TO_GROUP;
                } else {
                    pMessage.action = parladuino.actions.RESPOND_TO_ID;
                }

                this.send(pMessage);

            }
        }

    }

})(window.parladuino = window.parladuino || {})
