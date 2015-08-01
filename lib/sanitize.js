var Sanitize = module.exports = (function(){
    var Sanitize = {}

    // these functions will throw an error. Callers should try catch
    Sanitize.integer = function(num){
        var re = parseInt(num)
        if (isNaN(re)) throw "ERROR. Sanitize.integer.NaN"
        else return re
    }

    return Sanitize
}())
