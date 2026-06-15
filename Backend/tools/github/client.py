import os
from typing import Any, Dict
from dotenv import load_dotenv
import requests


load_dotenv(override=True)

class GitHubClient:
    BASE_URL = "https://api.github.com"

    def __init__(
        self,
        owner: str,
        repo: str,
        token: str | None = None,
    ):
        self.owner = owner
        self.repo = repo
        self.token = token or os.getenv("GITHUB_TOKEN")

        if not self.token:
            raise ValueError("GitHub token must be provided either as an argument or in the GITHUB_TOKEN environment variable.")

        self.headers = {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self.token}",
        }

    def _get(self, endpoint: str) -> Dict[str, Any]:
        url = f"{self.BASE_URL}{endpoint}"

        response = requests.get(
            url,
            headers=self.headers,
            timeout=30,
        )

        response.raise_for_status()

        return response.json()

    def _post(self, endpoint: str, data: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.BASE_URL}{endpoint}"

        response = requests.post(
            url,
            headers=self.headers,
            json=data,
            timeout=30,
        )

        response.raise_for_status()

        return response.json()

    def get_issue(
        self,
        issue_number: int,
    ) -> Dict[str, Any]:

        issue = self._get(
            f"/repos/{self.owner}/{self.repo}/issues/{issue_number}"
        )

        if "pull_request" in issue:
            raise ValueError(
                f"#{issue_number} is a Pull Request, not an Issue."
            )

        return issue

    def get_current_user(self) -> Dict[str, Any]:
        """
        Retrieves the profile of the authenticated user.
        """
        return self._get("/user")

    def create_fork(self) -> Dict[str, Any]:
        """
        Creates a fork of the repository under the authenticated user's account.
        """
        return self._post(f"/repos/{self.owner}/{self.repo}/forks", data={})

    def create_pull_request(
        self,
        title: str,
        body: str,
        head: str,
        base: str = "main",
    ) -> Dict[str, Any]:
        """
        Creates a Pull Request on GitHub.
        """
        data = {
            "title": title,
            "body": body,
            "head": head,
            "base": base,
        }

        return self._post(
            f"/repos/{self.owner}/{self.repo}/pulls",
            data=data,
        )
    


    