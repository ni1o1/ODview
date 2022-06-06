export function utctostrtime(time){
    return new Date(time).toLocaleDateString().replace(/\//g, "-") + " " + new Date(time).toTimeString().substr(0, 8)
}