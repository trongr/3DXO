var Validate = module.exports = (function(){
    var Validate = {}

    Validate.isInt = function(value) {
        if (isNaN(value)) {
            return false;
        }
        var x = parseFloat(value);
        return (x | 0) === x;
    }

    return Validate
}())
