(function () {
    'use strict';

    const version = '1.1.0';

    function unpack(value) {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
        return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
    }

    function mask(seed, index) {
        return (seed + (index * 31) + ((index % 7) * 17)) & 0xff;
    }

    function resolve(token) {
        const encoded = unpack(token);
        const seed = encoded[0];
        const decoded = encoded.slice(1).map((byte, index) => byte ^ mask(seed, index));
        return new TextDecoder().decode(decoded);
    }

    function hydrate(root) {
        root.querySelectorAll('[data-link-token]').forEach(link => {
            try {
                const destination = resolve(link.dataset.linkToken);
                link.href = destination;
                if (link.hasAttribute('data-link-label')) {
                    const separator = destination.indexOf(':');
                    const query = destination.indexOf('?');
                    const end = query === -1 ? destination.length : query;
                    link.textContent = destination.slice(separator + 1, end).replace(/^\/\//, '');
                }
                link.removeAttribute('data-link-token');
            } catch (error) {
                console.warn('Could not prepare link.', error);
            }
        });
    }

    window.LinkRuntime = { version, hydrate };
    hydrate(document);
}());
