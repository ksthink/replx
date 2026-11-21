# Replx Privacy Policy

[한국어](PRIVACY.md)

Effective date: November 21, 2026

Replx (the "Extension") is a Chrome extension that hides comment sections on web pages. This policy explains what information the Extension handles and how it is stored.

## Summary

- The Extension **does not send any information to the developer or to any third party.**
- It does not communicate with any external server and contains no analytics, advertising, or tracking code.
- Only your settings and the rules you create are stored, in your own browser (Chrome storage).

## 1. Information handled and why

| Information | Details | Purpose | Where it is stored |
|---|---|---|---|
| Settings | On/off, hiding style, whether auto-detection and comment-count hiding are enabled | To behave the way you chose | Chrome sync storage (`chrome.storage.sync`) |
| Site lists | Domains of sites you turned off or excluded (e.g. `news.example.com`) | To stay inactive on those sites | Chrome sync storage |
| User rules | Hide and exclude rules you create: a site domain and a CSS selector (e.g. `.comment_list`) | To hide, or keep visible, the areas you chose | Chrome sync storage |
| Hidden-area count | Number of comment areas hidden in the current tab | To show the number on the toolbar icon | Memory only (cleared when the tab closes or navigates) |

Rules contain only a site domain and a CSS selector. The Extension does not store page text, full page URLs, or your browsing history.

## 2. Processing of web page content

To find comment sections, the Extension reads the structure of the pages you open (element and class names) and short text snippets (such as "Comments 12" or "Reply") **only inside your browser**. This content is never stored or sent anywhere, and it is discarded when you leave the page.

## 3. Transfer and sharing

- The Extension makes no network requests.
- It does not sell or share any information with third parties.
- If Chrome Sync is turned on, Chrome syncs the settings and rules above across your devices through your Google Account. This sync is a Chrome feature provided by Google and is governed by the [Google Privacy Policy](https://policies.google.com/privacy). The developer has no access to this data.

## 4. Export and import

When you click "Export", your settings and rules are saved to a JSON or CSV file on your device. "Import" reads only the file you select. The Extension does not send these files anywhere.

## 5. Why each permission is needed

| Permission | Reason |
|---|---|
| `storage` | To save your settings and rules |
| `contextMenus` | To let you pick areas to hide or exclude from the right-click menu |
| Content scripts on all http/https sites | To find and hide comment sections on any site you visit |

## 6. Retention and deletion

- Information is kept until you delete it or uninstall the Extension.
- You can delete rules at any time from the popup, the "Exclude/Block list" window, or the settings page.
- Uninstalling the Extension makes Chrome remove the Extension's storage.

## 7. Children's privacy

The Extension does not collect personal information from anyone, including children.

## 8. Chrome Web Store policy compliance

The use of information by Replx adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use), including the Limited Use requirements.

## 9. Changes to this policy

If this policy changes, this document will be updated and the effective date above will change. The history of changes is available in the [GitHub repository](https://github.com/ksthink/replx/commits/main/PRIVACY.en.md).

## 10. Contact

For privacy questions, please contact:

- Email: [ksthink@metaphr.dev](mailto:ksthink@metaphr.dev)
- [GitHub Issues](https://github.com/ksthink/replx/issues)
