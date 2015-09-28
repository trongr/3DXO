var H = (function(){
    var H = {}

    H.log = function(msg, obj){
        if (obj) console.log(new Date().getTime() + " " + msg + " " + JSON.stringify(obj, 0, 2))
        else console.log(new Date().getTime() + " " + msg)
    }

    H.swapObjKeyValues = function(obj){
        var new_obj = {};
        for (var prop in obj) {
            if(obj.hasOwnProperty(prop)) {
                new_obj[obj[prop]] = prop;
            }
        }
        return new_obj;
    }

    H.length = function(obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    };

    H.s2mmss = function(s){
        var t = Math.abs(s)
        var sign, mm, ss;
        sign = (s < 0 ? "-" : "")
        mm = parseInt(t / 60, 10);
        ss = parseInt(t % 60, 10);
        mm = mm < 10 ? "0" + mm : mm;
        ss = ss < 10 ? "0" + ss : ss;
        return sign + mm + ":" + ss
    }

    return H
}())
