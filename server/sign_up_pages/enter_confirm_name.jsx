import koa_router from "koa-router";
import koa_body from "koa-body";
import React from "react";
import { renderToString } from "react-dom/server";
import models from "db/models";
import ServerHTML from "server/server-html";
import { getRemoteIp, checkCSRF } from "server/utils/misc";
// import { findDOMNode } from 'react-dom';
import MiniHeader from "app/components/modules/MiniHeader";
import config from "config";
import Mixpanel from "mixpanel";
import {validate_account_name} from 'app/utils/ChainValidation';
import Apis from 'shared/api_client/ApiInstances';
import Progress from 'react-foundation-components/lib/global/progress-bar';

var mixpanel = null;
if (config.has("mixpanel") && config.get("mixpanel")) {
    mixpanel = Mixpanel.init(config.get("mixpanel"));
}

var assets_file = "tmp/webpack-stats-dev.json";
if (process.env.NODE_ENV === "production") {
    assets_file = "tmp/webpack-stats-prod.json";
}
const assets = Object.assign({}, require(assets_file), { script: [] });

function onNameChange() {
    console.log("-->/onNamechange--")
    // const name2 = name.trim().toLowerCase();
    // validateAccountName(name2);
    // this.setState({name});
    // // this.setState({name2});
}

let nameChange = onNameChange.bind(this);

function* validateAccountName(name) {
    console.log(name)
    let promise;
    this.state({name_error: ''});
    let name_error = '';
    if (name.length > 0) {
        name_error = validate_account_name(name);
        if (!name_error) {
            this.setState({name_error: ''});
            promise = Apis.db_api('get_accounts', [name]).then(res => {
                return res && res.length > 0 ? 'Account name is not available' : '';
            });
        }
    }
    if (promise) {
        promise
            .then(name_error => this.setState({name_error}))
            .catch(() => this.setState({
                name_error: "Account name can't be verified right now due to server failure. Please try again later."
            }));
    } else {
        this.setState({name_error});
    }
}

export default function useEnterUserNamePages(app) {
    const router = koa_router();
    app.use(router.routes());
    const koaBody = koa_body();

    const name_error = '';
    const name = '';
    const submit_btn_disabled = '';
    const submit_btn_class = 'button';
    let eid = '';

    router.post("/submit_account", koaBody, function*() {
        // save identity
        console.log("-- /submit_account -->", this.session.uid, this.session.user);

        let user;
        user = yield models.User.findOne({
            where: {uid: this.session.uid }
        });
        if (!user) {
            // create user and identity
            console.log("-- /Creating User & Identity -->");
            user = yield models.User.create({
                uid: this.session.uid
            });
            yield models.Identity.create({
                user_id: user.id,
                uid: user.uid,
                verified: false,
                last_step: 1,
                user_name_picked: this.request.body.name
            });
        } else {
            // else update identity
            console.log("-- /Updating User Identity -->");
            const user_identity = yield models.Identity.findOne({
                where: { user_id: user.id }
            });
            yield user_identity.update({
                user_name_picked: this.request.body.name,
                last_step: 1
            });
        }

        // redirect to email verification
        this.redirect("/enter_email");
        return;
    });

    router.get("/pick_account", function*() {
        console.log("-- /pick_account -->", this.session.uid, this.session.user);
        this.session.user = null;
        const body = renderToString(
            <div className="App">
                <MiniHeader />
                <br />
                <div>
                    <div className="CreateAccount row">
                        <div className="column" style={{maxWidth: '36rem', margin: '0 auto'}}>
                            <Progress tabIndex="0" value={0} max={100} />
                            <form action="/submit_account" method="POST" autoComplete="off">
                                <h4 style={{ color: "#4078c0" }}>
                                    Please pick your new steemit username.
                                </h4>
                                <div className={name_error ? 'error' : ''}>
                                    <label>ACCOUNT NAME
                                        <input type="text" name="name" autoComplete="off" onChange={this.nameChange} value={name} />
                                    </label>
                                    <p>{name_error}</p>
                                </div>
                                <noscript>
                                    <div className="callout alert">
                                        <p>This form requires javascript to be enabled in your browser</p>
                                    </div>
                                </noscript>
                                <input disabled={submit_btn_disabled} type="submit" className={submit_btn_class} value="Continue" />
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        );
        const props = {body, title: "Pick Your Username", assets};
        this.body = "<!DOCTYPE html>" + renderToString(<ServerHTML {...props} />);
    });
}
