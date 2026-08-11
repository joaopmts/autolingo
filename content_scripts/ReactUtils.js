// Autolingo -- maintained by joaomtsplay@gmail.com
//
// Duolingo doesn't expose any public API for its lesson/skill data -- it's
// all just props sitting inside React's internal fiber tree. React stashes
// a reference to that tree on every DOM node it renders, under a property
// name that starts with "__reactFiber$" (the random suffix changes per
// React version/build). This just finds that property by prefix and reads
// it off, which is how the rest of the extension pulls real skill/challenge
// data out of the page without Duolingo ever exposing it directly.

export default class ReactUtils {
    constructor () {}

    ReactKey = (elem, prefix) => {
        // Object.keys() doesn't like null and undefined
        if (elem == null || elem == undefined) {
            return;
        }
    
        // find it's react internal instance key
        let key = Object.keys(elem).find(key => key.startsWith(prefix));
    
        // get the react internal instance
        return elem[key];
    }

    ReactInternal = (elem) => {
        return this.ReactKey(elem, "__reactInternalInstance$");
    }

    ReactEvents = (elem) => {
        return this.ReactKey(elem, "__reactEventHandlers$");
    }

    ReactFiber = (elem) => {
        return this.ReactKey(elem, "__reactFiber$");
    }
    
    ReactProps = (elem) => {
        return this.ReactKey(elem, "__reactProps$");
    }
}
