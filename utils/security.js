export const RegexCheck = {
    // Check if the ID is a a valid ID (alphanumeric and 5 characters long)
    isValidID: (id) => {
        return (/^[a-zA-Z0-9]{5}$/.test(id));
    }
};